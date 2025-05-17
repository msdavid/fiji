import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
  // This return is necessary for the component to be valid,
  // but it will not be rendered due to the redirect.
  return null;
}