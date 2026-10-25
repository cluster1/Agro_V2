import { redirect } from 'next/navigation'

// Signed-out users are sent to /login by middleware; the dashboard layout handles the rest.
export default function Home() {
  redirect('/dashboard')
}
