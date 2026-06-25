import EnrollClient from "./EnrollClient";

export default async function EnrollTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <EnrollClient token={token} />;
}
