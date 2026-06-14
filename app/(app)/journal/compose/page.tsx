import { Suspense } from 'react';
import { JournalComposeForm } from './journal-compose-form';
import { FullScreenLoader } from '@/components/ui/loading';

export default function JournalComposePage() {
  return (
    <Suspense fallback={<FullScreenLoader label="Loading editor…" />}>
      <JournalComposeForm />
    </Suspense>
  );
}
