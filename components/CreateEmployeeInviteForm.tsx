import React, { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

// TypeScript Types
interface CreateEmployeeInviteFormProps {
  workspaceId?: string | null;
  invitedByUserId: string;
  onSuccess?: () => void;
}

interface FormData {
  fullName: string;
  email: string;
  role: string;
}

interface RPCError {
  message: string;
  code?: string;
  details?: string;
}

interface RPCResponse {
  invite_id?: string;
  error?: string;
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Default form values
const DEFAULT_FORM_DATA: FormData = {
  fullName: '',
  email: '',
  role: 'employee',
};

export const CreateEmployeeInviteForm: React.FC<CreateEmployeeInviteFormProps> = ({
  workspaceId = null,
  invitedByUserId,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Validates form inputs
   */
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.role.trim()) {
      newErrors.role = 'Role is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  /**
   * Handles form input changes
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
      // Clear error for this field when user starts typing
      if (errors[name]) {
        setErrors((prev) => ({
          ...prev,
          [name]: '',
        }));
      }
    },
    [errors]
  );

  /**
   * Handles form submission and RPC call
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // Validate form
      if (!validateForm()) {
        toast.error('Please fix the errors in the form');
        return;
      }

      setIsLoading(true);

      try {
        // AUTHORIZATION STRATEGY:
        // Client-admins MUST use /api/employees endpoint
        // API infers workspace_id from auth context
        // Frontend sends ONLY email to prevent client-side auth bypasses

        const response = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email.trim(),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          // CRITICAL: Use the ACTUAL backend error message
          const backendError = data.error;
          if (backendError) {
            console.error('[CreateEmployeeInviteForm] Backend error (status', response.status + '):', backendError);
            toast.error(backendError);
            return;
          }
          
          // Fallback only if backend didn't provide error message
          console.error('[CreateEmployeeInviteForm] Unexpected error response:', data);
          toast.error('Failed to create invite');
          return;
        }

        // Success feedback
        toast.success('Employee invite created successfully!');
        console.log('[CreateEmployeeInviteForm] Invite created with ID:', data.invite?.id);

        // Reset form
        setFormData(DEFAULT_FORM_DATA);
        setErrors({});

        // Call optional success callback
        onSuccess?.();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        console.error('[CreateEmployeeInviteForm] Unexpected error:', err);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [formData, validateForm, onSuccess]
  );

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Create Employee Invite</h2>

      {/* Full Name Field */}
      <div className="mb-4">
        <label htmlFor="fullName" className="block text-sm font-medium mb-2">
          Full Name <span className="text-gray-500">(Optional)</span>
        </label>
        <input
          type="text"
          id="fullName"
          name="fullName"
          value={formData.fullName}
          onChange={handleInputChange}
          placeholder="John Doe"
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      {/* Email Field */}
      <div className="mb-4">
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleInputChange}
          placeholder="employee@example.com"
          disabled={isLoading}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
      </div>

      {/* Role Field */}
      <div className="mb-6">
        <label htmlFor="role" className="block text-sm font-medium mb-2">
          Role <span className="text-red-500">*</span>
        </label>
        <select
          id="role"
          name="role"
          value={formData.role}
          onChange={handleInputChange}
          disabled={isLoading}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
            errors.role ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
        {errors.role && <p className="text-red-500 text-sm mt-1">{errors.role}</p>}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Creating Invite...' : 'Create Invite'}
      </button>
    </form>
  );
};

export default CreateEmployeeInviteForm;
