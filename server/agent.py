from dataclasses import dataclass, field
from typing import Callable, Literal
import os

@dataclass
class UserMessage:
    role: Literal["user"] = "user"
    content: str = ""
    timestamp: int = 0


@dataclass
class AssistantMessage:
    role: Literal["assistant"] = "assistant"
    content: str = ""
    api: str | None = None
    provider: str | None = None
    model: str = ""
    responseModel: str = ""
    responseId: str = ""
    diagnostics: list[str] = field(default_factory=list)
    usage: object | None = None
    stopReason: str | None = None
    deferred: object | None = None
    rawStopReason: str | None = None
    timestamp: int = 0


@dataclass
class ToolResultMessage:
    role: Literal["toolResult"] = "toolResult"
    toolCallId: str = ""
    toolName: str = ""
    content: str = ""
    details: object | None = None
    usage: object | None = None
    addedToolNames: list[str] | None = None
    isError: bool = False
    timestamp: int = 0

@dataclass
class CustomAgentMessages:
    pass


AgentMessage = UserMessage | AssistantMessage | ToolResultMessage | CustomAgentMessages

@dataclass
class Model:
    id: str
    name: str
    api: str
    provider: str
    baseUrl: str
    reasoning: bool
    thinkingLevelMap: dict
    input: list[Literal["text", "image"]]
    cost: str
    contextWindow: int
    maxTokens: int
    samplingParams: str
    headers: str
    compatibility: str

@dataclass
class ModelCostRates:
    input: float
    output: float
    cacheRead: float
    cacheWrite: float

ThinkingLevel = Literal["off", "minimal", "low", "medium", "high", "xhigh", "max"]



@dataclass
class AgentTool:
    label: str
    prepareArguments: Callable | None = None
    execute: Callable | None = None # (toolCallId, params, onUpdate) => object
    executionMode: Literal["sequential", "parallel"] = "sequential"

@dataclass
class AgentToolCall:
  type: Literal["toolCall"]
  name: str
  arguments: object | None = None


@dataclass
class AgentToolResult:
    content: str
    details: object | None = None
    usage: object | None = None
    addedToolNames: list[str] | None = None
    terminate: bool = False


@dataclass
class BeforeToolCallResult:
    pass


@dataclass
class AfterToolCallResult:
    pass


@dataclass
class AgentContext:
    system_prompt: str
    messages: list[AgentMessage] = field(default_factory=list)
    tools: list[AgentTool] = field(default_factory=list)


DEFAULT_MODEL = "qwen3.7-max"
SYSTEM_PROMPT = """ you are a good assistant and you can use tools 
                    but when you are using tools you don't need say you are using the tools
                    you just ask the right questions """

@dataclass
class AgentState:
    model: str = DEFAULT_MODEL
    systemPrompt: str = ""
    tools: list[AgentTool] = field(default_factory=list)
    messages: list[AgentMessage] = field(default_factory=list)
    thinkingLevel: ThinkingLevel = "off"
    isStreaming: bool = False
    streamingMessage: AgentMessage | None = None
    pendingToolCalls: object | None = None
    errorMessage: str = ""

def createMutableAgentState(initialState: dict) -> AgentState:
    systemPrompt = initialState.get("systemPrompt") or SYSTEM_PROMPT
    agentState = AgentState()
    agentState.systemPrompt = systemPrompt
    agentState.model = initialState.get("model", DEFAULT_MODEL)
    agentState.thinkingLevel = initialState.get("thinkingLevel") or "off"
    agentState.tools = initialState.get("tools") or []
    agentState.messages = [
        {"role": "system", "content": systemPrompt},
        *initialState.get("messages", []),
    ]
    agentState.isStreaming = False
    agentState.streamingMessage = ""
    agentState.pendingToolCalls = []
    agentState.errorMessage = ""
    return agentState




class Agent:    
    def __init__(self, initialState) -> None:
        self.agentState: AgentState = createMutableAgentState(initialState)
        self.streamFunction: Callable | None = None
        self.listeners: list[object] = []
        self.steeringQueue: list[object] = []
        self.followUpQueue: list[object] = []
        self.activeRun: str | None = None
        self.sessionId: str | None = None
        self.thinkingBudgets: object | None = None
        self.maxRetryDelayMs: int = 0
        self.toolExecution: Literal["sequential", "parallel"] = "sequential"


    async def runLoop(self, prompts):
        # estimate tokens and compress

        #
        context = AgentContext(SYSTEM_PROMPT, self.agentState.messages, self.agentState.tools)
        #
        config = AgentLoopConfig(
            model=self.agentState.model,
            apiKey = os.environ.get("OPENAI_API_KEY", "").strip(),
            baseUrl = os.environ.get("OPENAI_BASE_URL", "").strip()           
        )

        loop = AgentLoop(prompts, context, config)
        async for chunk in loop.run():
            yield chunk
    
    def convertToLlm(self):
        pass

    def transformContext(self):
        pass

    def getApiKey(self):
        pass

    def beforeToolCall(self):
        pass

    def afterToolCall(self):
        pass

    def shouldStopAfterTurn(self):
        pass

    def prepareNextTurn(self):
        pass

    def prepareNextTurnWithContext(self):
        pass

    def prompt(self, message):
        pass

    def prompt(self, input, images=None):
        pass

    def runContinuation(self):
        pass

    def createContextSnapshot(self):
        pass

    def createLoopConfig(self):
        pass

    def runWithLifecycle(self):
        pass

    def handleRunFailure(self):
        pass

    def finishRun(self):
        pass

    def processEvents(self):
        pass


from .agent_loop import AgentLoop, AgentLoopConfig
