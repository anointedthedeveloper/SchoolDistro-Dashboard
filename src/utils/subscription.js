// Computes real-time status from expires_at + subscription_status
export function getSubscriptionState(school) {
    const now = new Date();
    const exp = school.expires_at ? new Date(school.expires_at) : null;

    if (school.subscription_status === 'suspended') {
        return { status: 'suspended', label: 'Suspended', color: '#8b5cf6', urgent: false };
    }
    if (exp && exp < now) {
        if (school.subscription_status === 'trial') {
            return { status: 'expired', label: 'Trial Ended — Purchase Key', color: '#ef4444', urgent: true };
        }
        return { status: 'expired', label: 'Expired — Renew License', color: '#ef4444', urgent: true };
    }
    if (school.subscription_status === 'trial') {
        if (!exp) return { status: 'trial', label: 'Trial', color: '#f59e0b', urgent: false };
        const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 1) return { status: 'trial', label: 'Trial — Expires Today', color: '#ef4444', urgent: true };
        return { status: 'trial', label: `Trial — ${daysLeft}d left`, color: '#f59e0b', urgent: false };
    }
    if (school.subscription_status === 'active') {
        if (exp) {
            const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 7) return { status: 'active', label: `Active — ${daysLeft}d left`, color: '#f59e0b', urgent: true };
        }
        return { status: 'active', label: 'Active', color: '#11b37f', urgent: false };
    }
    return { status: school.subscription_status, label: school.subscription_status, color: '#8fa8c8', urgent: false };
}

// Auto-expires schools whose expiry date has passed — call on dashboard load
export async function autoExpireSchools(supabase) {
    await supabase
        .from('schools')
        .update({ subscription_status: 'expired', is_active: false })
        .in('subscription_status', ['trial', 'active'])
        .lt('expires_at', new Date().toISOString())
        .not('expires_at', 'is', null);
}
