import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://bclwwzgmezigfhyphdcr.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjbHd3emdtZXppZ2ZoeXBoZGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODk2NjcsImV4cCI6MjA5MzA2NTY2N30.1jgXFU72suy1U1dPrXzzQcJLyzkcv2BmVLhvJ5xaRHA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
