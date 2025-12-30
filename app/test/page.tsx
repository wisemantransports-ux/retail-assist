import getSupabaseClient from '@/lib/supabaseClient';

export default async function Page() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return <pre>{JSON.stringify({ data: null, error: 'SUPABASE_NOT_CONFIGURED' }, null, 2)}</pre>;
  }

  const { data, error } = await supabase.from('test').select('*').maybeSingle();

  return <pre>{JSON.stringify({ data, error }, null, 2)}</pre>;
}
