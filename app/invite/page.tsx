import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import InviteForm from './invite-form';

/**
 * /invite Page
 * 
 * Allows users to accept employee invitations via a token from the invite link.
 * 
 * Features:
 * - Accept token from URL parameter
 * - Form with: email (required), first_name (required), last_name (optional)
 * - Submit to /api/employees/accept-invite
 * - Redirect to workspace dashboard on success
 * - Show errors as toast notifications
 */
export default function InvitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <Suspense
        fallback={
          <div className="flex items-center justify-center">
            <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
          </div>
        }
      >
        <InviteForm />
      </Suspense>
    </div>
  );
}

