import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://cjwcqeinhryhhepkkkle.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqd2NxZWluaHJ5aGhlcGtra2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODkzNDUsImV4cCI6MjA5MTU2NTM0NX0.Y7Se-LrPVRE0aiG1rYq599DvOEY7vKAEUg_S9tF4AD0"
);