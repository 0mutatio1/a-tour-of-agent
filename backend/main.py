"""Minimal stateless OpenAI streaming API."""

import json
import os
from collections.abc import AsyncIterator, AsyncGenerator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI, OpenAIError
from openai.types.responses import FunctionToolParam, ResponseInputParam
from openai.types.responses.response_function_tool_call_param import (
    ResponseFunctionToolCallParam,
)
from openai.types.responses.response_input_param import FunctionCallOutput

LOCAL_ALLOWED_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)

SYSTEM_PROMPT = """ you are a good assistant and you can use tools but when you are using tools you don't need say you are using the tools
                    you just ask the right questions """

TOOLS: list[FunctionToolParam] = [
    FunctionToolParam(
        type="function",
        name="get_weather",
        description="Get the current weather for a specific city",
        parameters={
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name"},
                "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
            },
            "required": ["city", "unit"],
            "additionalProperties": False,
        },
        strict=False,
    )
]
MAX_TOOL_ROUNDS = 4


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


def create_app() -> FastAPI:
    """Create the FastAPI application and its shared OpenAI client."""
    client: AsyncOpenAI | None = None
    model_name: str | None = None
    deployed_origins = tuple(
        origin.strip().rstrip("/")
        for origin in os.environ.get("FRONTEND_ORIGINS", "").split(",")
        if origin.strip()
    )

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
        nonlocal client, model_name
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        base_url = os.environ.get("OPENAI_BASE_URL", "").strip()
        configured_model = os.environ.get("OPENAI_MODEL", "").strip()
        if not api_key or not configured_model:
            raise RuntimeError("OPENAI_API_KEY and OPENAI_MODEL must be set")

        active_client = AsyncOpenAI(api_key=api_key, base_url=base_url or None)
        client = active_client
        model_name = configured_model
        try:
            yield
        finally:
            await active_client.close()
            client = None
            model_name = None

    application = FastAPI(
        title="Minimal OpenAI Stream",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(dict.fromkeys((*LOCAL_ALLOWED_ORIGINS, *deployed_origins))),
        allow_credentials=False,
        allow_methods=["POST"],
        allow_headers=["Content-Type"],
    )

    @application.post("/api/chat")
    async def chat(
        messages: Annotated[list[dict[str, str]], Body(embed=True, min_length=1)],
    ) -> StreamingResponse:
        if not messages:
            raise HTTPException(status_code=422, detail="messages must not be empty")
        for message in messages:
            if message.get("role") not in {"user", "assistant"} or not message.get("content"):
                raise HTTPException(status_code=422, detail="messages must have role and content")
        if client is None or model_name is None:
            raise HTTPException(status_code=503, detail="OpenAI client is unavailable")

        conversation: ResponseInputParam = [
            { "role": "system", "content": SYSTEM_PROMPT },
            *messages,
        ]
        try:
            stream = await client.responses.create(
                model=model_name,
                input=conversation,
                temperature=1,
                reasoning={"effort": "medium"},
                tools=TOOLS,
                tool_choice="auto",
                timeout=180,
                stream=True,
                store=False,
            )
        except OpenAIError as error:
            raise HTTPException(status_code=502, detail="OpenAI request failed") from error

        async def relay_events() -> AsyncIterator[bytes]:
            current_stream = stream
            for _tool_round in range(MAX_TOOL_ROUNDS):
                completed_response = None
                try:
                    async with current_stream:
                        async for event in current_stream:
                            if event.type == "response.reasoning_text.delta":
                                print(event.delta, end="", flush=True)
                                payload = json.dumps({"delta": event.delta}, ensure_ascii=False)
                                yield (
                                    "event: response.reasoning_text.delta\n"
                                    f"data: {payload}\n\n"
                                ).encode()
                            elif event.type == "response.output_text.delta":
                                print(event.delta, end="", flush=True)
                                payload = json.dumps({"delta": event.delta}, ensure_ascii=False)
                                yield (
                                    "event: response.output_text.delta\n"
                                    f"data: {payload}\n\n"
                                ).encode()
                            elif event.type == "response.completed":
                                completed_response = event.response
                            elif event.type in {"error", "response.failed", "response.incomplete"}:
                                payload = json.dumps({"error": "Model response failed"})
                                yield f"event: error\ndata: {payload}\n\n".encode()
                                yield b"data: [DONE]\n\n"
                                return
                except OpenAIError:
                    payload = json.dumps({"error": "OpenAI stream failed"})
                    yield f"event: error\ndata: {payload}\n\n".encode()
                    yield b"data: [DONE]\n\n"
                    return

                if completed_response is None:
                    payload = json.dumps({"error": "OpenAI stream ended unexpectedly"})
                    yield f"event: error\ndata: {payload}\n\n".encode()
                    yield b"data: [DONE]\n\n"
                    return

                function_calls = [
                    item for item in completed_response.output if item.type == "function_call"
                ]
                if not function_calls:
                    print(flush=True)
                    yield b"data: [DONE]\n\n"
                    return

                for function_call in function_calls:
                    conversation.append(
                        ResponseFunctionToolCallParam(
                            type="function_call",
                            call_id=function_call.call_id,
                            name=function_call.name,
                            arguments=function_call.arguments,
                        )
                    )
                    conversation.append(
                        FunctionCallOutput(
                            type="function_call_output",
                            call_id=function_call.call_id,
                            output=execute_tool(function_call.name, function_call.arguments),
                        )
                    )

                try:
                    current_stream = await client.responses.create(
                        model=model_name,
                        input=conversation,
                        temperature=1,
                        reasoning={"effort": "medium"},
                        tools=TOOLS,
                        tool_choice="auto",
                        timeout=180,
                        stream=True,
                        store=False,
                    )
                except OpenAIError:
                    payload = json.dumps({"error": "OpenAI tool continuation failed"})
                    yield f"event: error\ndata: {payload}\n\n".encode()
                    yield b"data: [DONE]\n\n"
                    return

            payload = json.dumps({"error": "Tool-call limit reached"})
            yield f"event: error\ndata: {payload}\n\n".encode()
            yield b"data: [DONE]\n\n"

        return StreamingResponse(
            relay_events(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Content-Type-Options": "nosniff",
                "X-Accel-Buffering": "no",
            },
        )

    return application


app = create_app()
