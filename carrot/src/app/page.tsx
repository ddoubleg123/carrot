type Search = { jobId?: string; src?: string };

export default function Home({ searchParams }: { searchParams: Search }) {
  const worker = process.env.NEXT_PUBLIC_WORKER_URL || 'http://127.0.0.1:8080';
  const src =
    (searchParams?.src && decodeURIComponent(searchParams.src)) ||
    (searchParams?.jobId ? `${worker}/media/ingest/${searchParams.jobId}.mp4` : undefined);

  return (
    <main style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24,background:'#0b0f17',color:'#e6edf3'}}>
      <div style={{maxWidth:960,width:'100%'}}>
        <h1 style={{marginBottom:16,fontSize:28,fontWeight:700}}>Demo: Ingested Video</h1>
        {src ? (
          <>
            <p style={{marginBottom:12,opacity:.8}}>Source: <code>{src}</code></p>
            <video
              key={src}
              src={src}
              controls
              style={{width:'100%',borderRadius:12,background:'#000'}}
            />
          </>
        ) : (
          <p style={{opacity:.8}}>
            Provide <code>?jobId=&lt;your-job-id&gt;</code> after triggering ingest (e.g. <code>/?jobId=job-123</code>)
            or pass a direct <code>?src=</code> URL.
          </p>
        )}
      </div>
    </main>
  );
}
