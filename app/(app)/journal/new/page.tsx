import { redirect } from 'next/navigation';

export default function JournalNewRedirect() {
  redirect('/journal/compose');
}
