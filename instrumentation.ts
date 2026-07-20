export async function register() {
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.AGENTPOND_ENABLED !== 'true'
  ) {
    return;
  }

  const [
    { createVercelSpanExporter },
    { isOpenInferenceSpan, OpenInferenceSimpleSpanProcessor },
    { registerOTel }
  ] = await Promise.all([
    import('@agentpond/vercel'),
    import('@arizeai/openinference-vercel'),
    import('@vercel/otel')
  ]);

  registerOTel({
    serviceName: 'agentdock',
    spanProcessors: [
      new OpenInferenceSimpleSpanProcessor({
        exporter: createVercelSpanExporter(),
        spanFilter: isOpenInferenceSpan,
        reparentOrphanedSpans: true
      })
    ]
  });
}
