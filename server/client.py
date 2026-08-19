from openai import AsyncOpenAI, OpenAIError


clients: dict[tuple[str, str], AsyncOpenAI] = {}

def getClient(api_key: str, base_url: str | None = None) -> AsyncOpenAI:
    """Return the cached AsyncOpenAI client for the given key/base URL pair."""
    key = (api_key, base_url or "")
    client = clients.get(key)
    if client is None:
        try:
            client = AsyncOpenAI(api_key=api_key, base_url=base_url or None)
        except OpenAIError as error:
            raise OpenAIError(
                f"Failed to create OpenAI client (base_url={base_url or 'default'}): {error}"
            ) from error
        clients[key] = client
    return client
