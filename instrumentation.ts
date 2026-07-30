/** Registers opt-in AgentPond tracing for the Next.js Node.js runtime. */
export async function register() {
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.AGENTPOND_ENABLED !== 'true'
  ) {
    return;
  }

  const [
    { createFilesSpanExporterFromRuntimeEnv },
    { isOpenInferenceSpan, OpenInferenceSimpleSpanProcessor },
    { registerOTel }
  ] = await Promise.all([
    import('@agentpond/files-sdk/otel'),
    import('@arizeai/openinference-vercel'),
    import('@vercel/otel')
  ]);

  registerOTel({
    serviceName: 'agentdock',
    spanProcessors: [
      new OpenInferenceSimpleSpanProcessor({
        exporter: createFilesSpanExporterFromRuntimeEnv(),
        spanFilter: isOpenInferenceSpan,
        reparentOrphanedSpans: true
      })
    ]
  });
}
