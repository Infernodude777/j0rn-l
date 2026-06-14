import { Suspense } from 'react';
import { FullScreenLoader } from '@/components/ui/loading';
import { RantForm } from './rant-form';

export default function DailyRantPage() {
  return (
    <Suspense fallback={<FullScreenLoader label="Opening the page\u2026" />}>
      <RantForm />
    </Suspense>
  );
}
