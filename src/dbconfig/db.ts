
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oetecqkhxulsxfwfmyaq.supabase.co'
const supabaseKey = 'sb_publishable_eKYoxKUHY4EWPIesf25CPA_LN_t6ebj'
const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase