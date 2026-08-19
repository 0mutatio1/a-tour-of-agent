from dataclasses import dataclass, replace, field
from typing import Awaitable, Callable, Literal
import json
from openai import AsyncOpenAI, OpenAIError
from .client import getClient
from openai.types.responses.response_input_param import FunctionCallOutput


from .agent import (
    AfterToolCallResult,
    AgentContext,
    AgentMessage,
    AgentToolCall,
    AssistantMessage,
    BeforeToolCallResult,
    Model,
    ToolResultMessage,
)

ToolExecutionMode = Literal["sequential", "parallel"]


@dataclass
class NextTurnContext:
    message: AssistantMessage
    context: AgentContext
    toolResults: list[ToolResultMessage]
    newMessages: list[AgentMessage]


@dataclass
class ShouldStopAfterTurnResult:
    stop: Literal["yes", "no"] = "no"
    newMessages: list[AgentMessage] | None = None


@dataclass
class AgentLoopConfig:
    model: Model
    apiKey: str | None = None
    baseUrl: str | None = None
    temperature: float = 1.0
    reasoning: dict | None =  field(default_factory=lambda: {"effort": "low"})
    timeout: float = 180.0
    maxOutputTokens: int | None = None
    convertToLlm: Callable[[], Model] | None = None
    transformContext: Callable[[AgentContext], AgentContext] | None = None
    getApiKey: Callable[[], Awaitable[str | None]] | None = None
    shouldStopAfterTurn: Callable[[NextTurnContext], ShouldStopAfterTurnResult | None] | None = None
    prepareNextTurn: Callable[[NextTurnContext], NextTurnContext] | None = None
    getSteeringMessages: Callable[[], Awaitable[list[AgentMessage]]] | None = None
    getFollowUpMessages: Callable[[], Awaitable[list[AgentMessage]]] | None = None
    toolExecutionMode: ToolExecutionMode = "sequential"
    beforeToolCall: Callable[[AgentContext, AgentToolCall], BeforeToolCallResult | None] | None = None
    afterToolCall: Callable[[ToolResultMessage], AfterToolCallResult | None] | None = None


def execute_tool(name: str, arguments: str) -> str:
    """Execute the small, explicitly allowed local tool set."""
    if name != "get_weather":
        return json.dumps({"error": "Unknown tool"})

    try:
        raw_arguments: object = json.loads(arguments)
    except json.JSONDecodeError:
        return json.dumps({"error": "Invalid tool arguments"})
    if not isinstance(raw_arguments, dict):
        return json.dumps({"error": "Invalid tool arguments"})

    city = raw_arguments.get("city")
    unit = raw_arguments.get("unit")
    if not isinstance(city, str) or unit not in {"celsius", "fahrenheit"}:
        return json.dumps({"error": "Invalid tool arguments"})

    print(f">>>> get_weather: city={city}, unit={unit}", flush=True)
    return json.dumps(
        {
            "city": city,
            "temperature": 13.2,
            "unit": unit,
            "conditions": "clear",
            "humidity": 93,
        }
    )


class AgentLoop:
    def __init__(
        self,
        prompts: list[AgentMessage],
        context: AgentContext,
        config: AgentLoopConfig,
    ) -> None:
        self.prompts = prompts
        self.context = context
        self.config = config

    async def run(self):
        newMessages = [*self.prompts]
        currentContext = replace(
            self.context,
            messages=[*self.context.messages, *self.prompts],
        )
        # emit agent_start

        pendingMessages = (
            await self.config.getSteeringMessages()
            if self.config.getSteeringMessages
            else []
        )

        while True:
            firstTurn = True
            hasMoreToolCalls = True
            while hasMoreToolCalls or len(pendingMessages) > 0:
                if firstTurn:
                    # emit turn_start
                    firstTurn = False
                if len(pendingMessages) > 0:
                    for msg in pendingMessages:
                        # emit steering_message
                        currentContext.messages.append(msg)
                        newMessages.append(msg)
                pendingMessages = []

                #message = await streamResponse(currentContext, "", newMessages, []);
                message: list[str] = []
                completed_response = None
                failed = False
                try:
                    stream = await getClient(self.config.apiKey, self.config.baseUrl).responses.create(
                        model=self.config.model,
                        input=currentContext.messages,
                        temperature=self.config.temperature,
                        reasoning=self.config.reasoning,
                        tools=currentContext.tools,
                        tool_choice="auto",
                        timeout=self.config.timeout,
                        stream=True,
                        store=False,
                    )
                    async with stream:
                        async for event in stream:
                            kind = event.type
                            if kind == "response.reasoning_text.delta":                                
                                yield self.sse(kind, {"delta": event.delta})
                            elif event.type == "response.output_text.delta":
                                message.append(event.delta)
                                yield self.sse(kind, {"delta": event.delta})
                            elif event.type == "response.completed":
                                completed_response = event.response                                
                            elif event.type in {
                                "error",
                                "response.failed",
                                "response.incomplete",
                            }:
                                failed = True
                                yield self.sse("error", {"error": "Modal response failed"})
                                break
                except OpenAIError:
                    yield self.sse("error", {"error": "OpenAI stream failed"})
                    yield b"data: [DONE]\n\n"
                    return

                if failed:
                    yield b"data: [DONE]\n\n"
                    return
                if completed_response is None:
                    yield self.sse("error", {"error": "OpenAI stream ended unexpectedly"})
                    yield b"data: [DONE]\n\n"
                    return

                assistant_text = "".join(message)
                if assistant_text:
                    newMessages.append({"role": "assistant", "content": assistant_text})

                toolCalls = [
                    item for item in completed_response.output if item.type == "function_call"
                ]
                if not toolCalls:
                    yield b"data: [DONE]\n\n"
                    return

                toolResults: list[ToolResultMessage] = []
                hasMoreToolCalls = len(toolCalls) > 0
                if len(toolCalls) > 0:
                    for toolCall in toolCalls:
                        if self.config.beforeToolCall:
                            self.config.beforeToolCall(currentContext, toolCall)
                        #
                        toolResults.append(
                            FunctionCallOutput(
                                type="function_call_output",
                                call_id=toolCall.call_id,
                                output=execute_tool(
                                    toolCall.name, toolCall.arguments
                                ),
                            )
                        )
                    for result in toolResults:
                        currentContext.messages.append(result)
                        newMessages.append(result)
                        if self.config.afterToolCall:
                            self.config.afterToolCall(result)
			

                nextTurnContext = NextTurnContext(
                    message=message,
                    context=currentContext,
                    toolResults=toolResults,
                    newMessages=newMessages,
                )

                stopResult = (
                    self.config.shouldStopAfterTurn(nextTurnContext)
                    if self.config.shouldStopAfterTurn
                    else None
                )
                if stopResult:
                    if stopResult.newMessages:
                        newMessages = stopResult.newMessages
                    if stopResult.stop == "yes":
                        break

                if self.config.prepareNextTurn:
                    currentContext = self.config.prepareNextTurn(
                        nextTurnContext
                    ).context

                # emit turn_end

            followUpMessages = (
                await self.config.getFollowUpMessages()
                if self.config.getFollowUpMessages
                else []
            ) or []
            if len(followUpMessages) > 0:
                pendingMessages = followUpMessages
                continue
            break

        # emit agent_end

    def sse(sefl, event: str, payload: dict) -> bytes:
        return (
            f"event: {event}\n"
            f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
        ).encode()