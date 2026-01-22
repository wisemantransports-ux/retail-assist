// Server component layout for invite page
// Must be server-side to support dynamic export

export const dynamic = 'force-dynamic';

export default function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
