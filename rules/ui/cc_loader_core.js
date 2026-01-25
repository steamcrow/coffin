async function loadScript(url) {
  console.log("🌐 FETCHING:", url);

  const res = await fetch(`${url}?t=${Date.now()}`);
  console.log("📡 FETCH STATUS:", res.status, res.ok);

  if (!res.ok) {
    throw new Error("Fetch failed for " + url);
  }

  const code = await res.text();
  console.log("📄 SCRIPT SIZE:", code.length);

  const blob = new Blob([code], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = blobUrl;
    s.onload = () => {
      console.log("✅ SCRIPT EXECUTED:", url);
      URL.revokeObjectURL(blobUrl);
      resolve();
    };
    s.onerror = (e) => {
      console.error("❌ SCRIPT ERROR:", url, e);
      reject(e);
    };
    document.head.appendChild(s);
  });
}
