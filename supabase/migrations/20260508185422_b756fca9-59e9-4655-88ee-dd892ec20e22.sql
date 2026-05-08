REVOKE EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';