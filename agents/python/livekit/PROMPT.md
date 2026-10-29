Before writing any code, invoke the `/agents` skill to learn the correct ElevenLabs SDK patterns.

Build a LiveKit Agents console voice agent that uses ElevenLabs Realtime through `livekit-plugins-elevenlabs`.

## `main.py`

- Import everything at the top, then call `load_dotenv()`. The plugin reads `ELEVEN_API_KEY` from the environment.
- Create an `AgentServer` and an `@server.rtc_session()` entrypoint that sets `ctx.log_context_fields = {"room": ctx.room.name}`.
- Build an `AgentSession` with `llm=elevenlabs.realtime.RealtimeModel(model="eleven_realtime_v1_mini", voice="brian", language="en")`.
- Subclass `Agent` with short voice-first instructions (no formatting, emojis or symbols) that tell it to use `lookup_weather` for weather questions.
- Greet the user in `on_enter` with `self.session.generate_reply()`.
- Add a `lookup_weather(context: RunContext, location: str)` `@function_tool` with a Google-style docstring (it becomes the tool schema) that logs the lookup and returns a canned sunny forecast.
- Call `await session.start(agent=Assistant(), room=ctx.room)`, then `await ctx.connect()`.
- Run with `cli.run_app(server)` under `if __name__ == "__main__":`.
