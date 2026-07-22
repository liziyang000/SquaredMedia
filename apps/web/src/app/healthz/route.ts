export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      status: "ok",
      release: process.env.SQUAREDMEDIA_RELEASE_ID || "local"
    },
    {
      headers: {
        "Cache-Control": "private, no-store"
      }
    }
  );
}
