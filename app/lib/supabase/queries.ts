// Supabase client placeholder (replace with real client)
export const supabaseClient = null;

// -----------------------------
// Invitations
// -----------------------------
export const acceptInvite = async (inviteId: string, userId?: string) => {
	return { success: true, data: { inviteId, userId } } as any;
};

// -----------------------------
// Mobile Money
// -----------------------------
export const approveMobileMoneyPayment = async (paymentId: string, adminId?: string | null, options?: any) => {
	// Stub: mark a mobile-money payment as approved and return a result object
	return { success: true, data: { paymentId, adminId, options } } as any;
};
export const confirmMobileMoneyPaymentBilling = async (paymentId: string, userId?: string | null, notes?: string) => {
	// Stub: confirm mobile-money payment and record confirmation details
	return { success: true, data: { paymentId, userId, notes } } as any;
};
export const createMobileMoneyPaymentBilling = async (
		subscriptionId: string,
		workspaceId: string,
		phoneNumber: string,
		amount: number,
		referenceCode: string,
		provider: 'mtn' | 'vodacom' | 'airtel' | 'orange' | 'smega' | string
	) => {
		// Minimal stub for mobile-money billing records.
		// In Botswana, common providers include Orange Money and Smega — include them here.
		return {
			data: {
				id: `momo_${Date.now()}`,
				subscription_id: subscriptionId,
				workspace_id: workspaceId,
				phone_number: phoneNumber,
				amount,
				reference_code: referenceCode,
				provider,
				status: 'pending',
				currency: 'BWP',
				created_at: new Date().toISOString(),
			},
		} as any;
	};
// Simple helper for botswana mobile-money flows: phone, name, provider
export const createMobileMoneyPayment = async (phoneNumber: string, name: string, provider: 'orange' | 'smega' | string) => {
	return {
 		data: {
 			id: `momo_${Date.now()}`,
 			phone_number: phoneNumber,
 			name,
 			provider,
 			status: 'pending',
 			currency: 'BWP',
 			created_at: new Date().toISOString(),
 		},
 	} as any;
};
export const saveMobileMoneyPayment = async (
	workspaceIdOrData: any,
	userId?: string,
	phoneNumber?: string,
	amount?: number,
	referenceCode?: string
) => {
	if (typeof workspaceIdOrData === 'object') {
		// legacy: single object
		return { success: true, data: workspaceIdOrData } as any;
	}

	const record = {
		id: `momo_${Date.now()}`,
		workspace_id: workspaceIdOrData,
		user_id: userId,
		phone_number: phoneNumber,
		amount,
		reference_code: referenceCode,
		status: 'pending',
		created_at: new Date().toISOString(),
	};

	return { success: true, data: record } as any;
};
export const rejectMobileMoneyPayment = async (paymentId: string, adminId?: string | null, reason?: string) => {
	return { success: true, data: { paymentId, adminId, reason } } as any;
};


// -----------------------------
// Billing / Plans
// -----------------------------
export const getPlanById = async (planId: string) => ({ data: null, error: null });
export const recordBillingEvent = async (
	workspaceId: string,
	event: string,
	subscriptionId?: string,
	userId?: string | undefined,
	metadata?: any
) => ({ success: true });
export const updateSubscriptionBilling = async (subscriptionId: string, statusOrData: string | any) => {
	// Accept either a status string or an object with billing fields (e.g. { status, last_payment_date })
	return { success: true, data: { subscriptionId, payload: statusOrData } } as any;
};
export const updateSubscriptionStatus = async (subscriptionId: string, statusOrData: string | any) => {
	return { success: true, data: { subscriptionId, payload: statusOrData } } as any;
};
export const getWorkspaceSubscription = async (workspaceId: string) => ({ data: null, error: null });

// -----------------------------
// Agents
// -----------------------------
export const createAgent = async (workspaceId: string, agentData: any) => ({ id: `a_${Date.now()}`, workspace_id: workspaceId, ...agentData });
export const getCurrentUser = async () => ({ data: null });

// -----------------------------
// Automation
// -----------------------------
export const createAutomationRule = async (workspaceIdOrData: any, agentId?: string, ruleData?: any) => {
	if (typeof workspaceIdOrData === 'object') {
		return { success: true, data: workspaceIdOrData } as any;
	}
	const rule = { id: `rule_${Date.now()}`, workspace_id: workspaceIdOrData, agent_id: agentId, ...ruleData };
	return { success: true, data: rule } as any;
};
export const updateAutomationRule = async (ruleId: string, ruleData: any) => ({ success: true, data: { ruleId, ...ruleData } } as any);

// -----------------------------
// Workspace / Members
// -----------------------------
export const updateMemberRole = async (workspaceId: string, userId: string, role: string, actorId?: string) => {
	return { success: true, data: { workspaceId, userId, role, actorId } } as any;
};

// -----------------------------
// Payments
// -----------------------------
export const updatePaymentStatus = async (paymentId: string, status: string, meta?: any) => {
	return { success: true, data: { paymentId, status, meta } } as any;
};

// -----------------------------
// Comments / Messages / Logs (stubs expected elsewhere in the app)
// -----------------------------
export const saveComment = async (agentId: string, commentData: any) => ({ id: `c_${Date.now()}`, ...commentData });
export const markCommentProcessed = async (commentId: string, reply?: string, publicReplyId?: string) => {
	return { success: true, data: { commentId, reply, publicReplyId } } as any;
};
export const createDirectMessage = async (workspaceId: string, data: any) => {
	const dm = { id: `dm_${Date.now()}`, workspace_id: workspaceId, ...data, created_at: new Date().toISOString() };
	return { success: true, data: dm, id: dm.id } as any;
};
export const createAuditLog = async (workspaceIdOrData: any, userId?: string | null, action?: string, itemType?: string, itemId?: string, metadata?: any) => {
	if (typeof workspaceIdOrData === 'object') {
		return { success: true, data: workspaceIdOrData } as any;
	}
	const record = { id: `log_${Date.now()}`, workspace_id: workspaceIdOrData, user_id: userId, action, item_type: itemType, item_id: itemId, metadata, created_at: new Date().toISOString() };
	return { success: true, data: record } as any;
};
export const logMessage = async (workspaceId: string, data: any) => ({ success: true });

// -----------------------------
// Agents / lookups
// -----------------------------
export const getAgentById = async (agentId: string) => {
	// Return a minimal agent object shape expected by callers.
	// Replace with real DB lookup when integrating.
	return {
		id: agentId,
		enabled: true,
		workspace_id: 'workspace_default',
		system_prompt: 'You are a helpful retail assistant',
		model: 'gpt-4o-mini',
		temperature: 0.2,
		max_tokens: 1024,
		fallback: 'Thank you for your comment. We will get back to you shortly.',
	} as any;
};

// -----------------------------
// Payments / Billing helpers (additional stubs)
// -----------------------------
export const createPayment = async (workspaceIdOrData: any, userId?: string, amount?: number, provider?: string, metadata?: any) => {
	if (typeof workspaceIdOrData === 'object') {
		return { success: true, data: workspaceIdOrData } as any;
	}

	const payment = {
		id: `pay_${Date.now()}`,
		workspace_id: workspaceIdOrData,
		user_id: userId,
		amount,
		provider,
		metadata,
		status: 'created',
		created_at: new Date().toISOString(),
	};

	return { success: true, data: payment } as any;
};
export const recordBillingPayment = async (
	subscriptionId: string,
 	workspaceId: string,
 	amount: number,
 	currency: string,
 	provider: string,
 	providerReference?: string,
 	metadata?: any
) => {
 	return { success: true, data: { subscriptionId, workspaceId, amount, currency, provider, providerReference, metadata } } as any;
};
export const createSubscription = async (workspaceIdOrData: any, data?: any) => {
	if (typeof workspaceIdOrData === 'object') {
		return { id: `sub_${Date.now()}`, ...workspaceIdOrData } as any;
	}
	return { id: `sub_${Date.now()}`, workspace_id: workspaceIdOrData, ...data } as any;
};
export const recordPaymentSuccess = async (workspaceId: string, paymentData: any) => ({ success: true, data: paymentData });

// -----------------------------
// Automation helpers
// -----------------------------
export const deleteAutomationRule = async (ruleId: string) => ({ success: true });
export const getAutomationRules = async (workspaceId?: string, agentId?: string, includeDisabled?: boolean) => [] as any[];
export const hasAlreadyReplied = async (params: any) => false;
export const logAutomationAction = async (data: any) => ({ success: true });

// -----------------------------
// Plans / billing lookups
// -----------------------------
export const getAllPlans = async () => ({ data: [], error: null });
export const getBillingPaymentHistory = async (workspaceId: string) => ({ data: [], error: null });
export const getPendingMobileMoneyPayments = async (workspaceId: string) => ({ data: [], error: null });

// -----------------------------
// Subscriptions / system
// -----------------------------
export const getSubscriptionByProviderId = async (providerOrId: string, idMaybe?: string) => {
	// Flexible signature: callers sometimes pass (provider, id) and sometimes only the provider-specific id.
	const id = idMaybe ?? providerOrId;
	const provider = idMaybe ? providerOrId : 'paypal';
	// Return a minimal subscription-like object; replace with real DB lookup when integrating.
	return { id, provider, workspace_id: 'workspace_default' } as any;
};

// Return a user's subscription (minimal stub)
export const getUserSubscription = async (userId: string) => {
	// Replace with real DB lookup; return null if no subscription
	return { id: `sub_${Date.now()}`, user_id: userId, status: 'inactive', workspace_id: 'workspace_default' } as any;
};
export const insertSystemLog = async (
	level: string,
	workspaceId?: string | null,
	userId?: string | null,
	context?: string,
	message?: string,
	metadata?: any,
	stackTrace?: string | null
) => {
	return { success: true, data: { level, workspaceId, userId, context, message, metadata, stackTrace } } as any;
};

// -----------------------------
// Workspace invites / members
// -----------------------------
export const inviteMember = async (workspaceId: string, email: string, role?: string, inviterId?: string) => {
	return { success: true, data: { workspaceId, email, role, inviterId } } as any;
};
export const removeMember = async (workspaceId: string, userId: string, actorId?: string) => {
	return { success: true, data: { workspaceId, userId, actorId } } as any;
};
