


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."is_bill_creator"("target_bill" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.dutch_pay_bills b
    where b.id = target_bill and b.creator_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_bill_creator"("target_bill" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_bill_participant"("target_bill" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.dutch_pay_members m
    where m.bill_id = target_bill and m.profile_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_bill_participant"("target_bill" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_room_member"("target_room" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.participants p
    where p.room_id = target_room
      and p.profile_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_room_member"("target_room" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."calendar_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "color" "text",
    "time" "text",
    "end_time" "text",
    "start_date" "date",
    "end_date" "date",
    "calendar_event_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "calendar_notes_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'best'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."calendar_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dutch_pay_bills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "creator_id" "uuid",
    "title" "text" NOT NULL,
    "total_amount" integer DEFAULT 0 NOT NULL,
    "split_count" integer DEFAULT 1 NOT NULL,
    "bank_name" "text" DEFAULT ''::"text" NOT NULL,
    "account_number" "text" DEFAULT ''::"text" NOT NULL,
    "account_holder" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dutch_pay_bills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dutch_pay_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bill_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "name" "text" NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dutch_pay_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'mate'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "follows_no_self" CHECK (("follower_id" <> "following_id")),
    CONSTRAINT "follows_role_check" CHECK (("role" = ANY (ARRAY['leader'::"text", 'mate'::"text"])))
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "sender_name" "text" NOT NULL,
    "sender_color" "text" DEFAULT '#23A455'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "bank_name" "text" DEFAULT ''::"text" NOT NULL,
    "account_number" "text" DEFAULT ''::"text" NOT NULL,
    "amount" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "name" "text" NOT NULL,
    "avatar_color" "text" DEFAULT '#23A455'::"text" NOT NULL,
    "avatar_url" "text",
    "personal_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "schedule" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "voted_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "start_location_name" "text",
    "start_latitude" double precision,
    "start_longitude" double precision,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "tag" "text" NOT NULL,
    "avatar_color" "text" DEFAULT '#23A455'::"text" NOT NULL,
    "avatar_url" "text",
    "personal_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "schedule" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "privacy_settings" "jsonb" DEFAULT '{"gender": "public", "birthdate": "public", "bank_account": "private"}'::"jsonb" NOT NULL,
    "push_token" "text",
    "start_location_name" "text",
    "start_latitude" double precision,
    "start_longitude" double precision,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "meeting_date" "date" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "owner_id" "uuid",
    "is_confirmed" boolean DEFAULT false NOT NULL,
    "confirmed_slot" "text",
    "color" "text" DEFAULT '#23A455'::"text" NOT NULL,
    "location_name" "text",
    "latitude" double precision,
    "longitude" double precision,
    "ai_recommendations" "jsonb",
    "voting_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "memo" "text",
    "memo_visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "memo_author_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rooms_memo_visibility_check" CHECK (("memo_visibility" = ANY (ARRAY['public'::"text", 'best'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_time" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "slot_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."scheduled_time" OWNER TO "postgres";


ALTER TABLE ONLY "public"."calendar_notes"
    ADD CONSTRAINT "calendar_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dutch_pay_bills"
    ADD CONSTRAINT "dutch_pay_bills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dutch_pay_members"
    ADD CONSTRAINT "dutch_pay_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduled_time"
    ADD CONSTRAINT "scheduled_time_pkey" PRIMARY KEY ("id");



CREATE INDEX "dutch_pay_members_bill_idx" ON "public"."dutch_pay_members" USING "btree" ("bill_id");



CREATE INDEX "notifications_room_created_idx" ON "public"."notifications" USING "btree" ("room_id", "created_at" DESC);



ALTER TABLE ONLY "public"."calendar_notes"
    ADD CONSTRAINT "calendar_notes_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dutch_pay_bills"
    ADD CONSTRAINT "dutch_pay_bills_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dutch_pay_bills"
    ADD CONSTRAINT "dutch_pay_bills_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dutch_pay_members"
    ADD CONSTRAINT "dutch_pay_members_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."dutch_pay_bills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dutch_pay_members"
    ADD CONSTRAINT "dutch_pay_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_memo_author_id_fkey" FOREIGN KEY ("memo_author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scheduled_time"
    ADD CONSTRAINT "scheduled_time_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE "public"."calendar_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calendar_notes_select" ON "public"."calendar_notes" FOR SELECT TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR ("visibility" = 'public'::"text") OR (("visibility" = 'best'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."follows" "f"
  WHERE (("f"."follower_id" = "calendar_notes"."profile_id") AND ("f"."following_id" = "auth"."uid"()) AND ("f"."role" = 'leader'::"text")))))));



CREATE POLICY "calendar_notes_write_own" ON "public"."calendar_notes" TO "authenticated" USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."dutch_pay_bills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dutch_pay_bills_insert" ON "public"."dutch_pay_bills" FOR INSERT TO "authenticated" WITH CHECK (("creator_id" = "auth"."uid"()));



CREATE POLICY "dutch_pay_bills_modify_creator" ON "public"."dutch_pay_bills" FOR DELETE TO "authenticated" USING (("creator_id" = "auth"."uid"()));



CREATE POLICY "dutch_pay_bills_select" ON "public"."dutch_pay_bills" FOR SELECT TO "authenticated" USING ((("creator_id" = "auth"."uid"()) OR "public"."is_bill_participant"("id")));



ALTER TABLE "public"."dutch_pay_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dutch_pay_members_select" ON "public"."dutch_pay_members" FOR SELECT TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "public"."is_bill_creator"("bill_id")));



CREATE POLICY "dutch_pay_members_write" ON "public"."dutch_pay_members" TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "public"."is_bill_creator"("bill_id"))) WITH CHECK (true);



ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "follows_delete_own" ON "public"."follows" FOR DELETE TO "authenticated" USING ((("follower_id" = "auth"."uid"()) OR ("following_id" = "auth"."uid"())));



CREATE POLICY "follows_insert" ON "public"."follows" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "follows_select" ON "public"."follows" FOR SELECT TO "authenticated" USING ((("follower_id" = "auth"."uid"()) OR ("following_id" = "auth"."uid"())));



CREATE POLICY "follows_update_own" ON "public"."follows" FOR UPDATE TO "authenticated" USING (("follower_id" = "auth"."uid"()));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_insert_member" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_room_member"("room_id"));



CREATE POLICY "messages_select_member" ON "public"."messages" FOR SELECT TO "authenticated" USING ("public"."is_room_member"("room_id"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_insert_member" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_room_member"("room_id"));



CREATE POLICY "notifications_select_member" ON "public"."notifications" FOR SELECT TO "authenticated" USING ("public"."is_room_member"("room_id"));



ALTER TABLE "public"."participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "participants_delete" ON "public"."participants" FOR DELETE TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."rooms" "r"
  WHERE (("r"."id" = "participants"."room_id") AND ("r"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "participants_insert_self" ON "public"."participants" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "participants_select" ON "public"."participants" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "participants_update_self" ON "public"."participants" FOR UPDATE TO "authenticated" USING (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rooms_delete_owner" ON "public"."rooms" FOR DELETE TO "authenticated" USING ((("owner_id" = "auth"."uid"()) OR "public"."is_room_member"("id")));



CREATE POLICY "rooms_insert" ON "public"."rooms" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "rooms_select" ON "public"."rooms" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "rooms_update_member" ON "public"."rooms" FOR UPDATE TO "authenticated" USING ("public"."is_room_member"("id"));



ALTER TABLE "public"."scheduled_time" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scheduled_time_all_member" ON "public"."scheduled_time" TO "authenticated" USING ("public"."is_room_member"("room_id")) WITH CHECK ("public"."is_room_member"("room_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."participants";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."rooms";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."is_bill_creator"("target_bill" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_bill_creator"("target_bill" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_bill_creator"("target_bill" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_bill_participant"("target_bill" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_bill_participant"("target_bill" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_bill_participant"("target_bill" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_room_member"("target_room" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_room_member"("target_room" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_room_member"("target_room" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."calendar_notes" TO "anon";
GRANT ALL ON TABLE "public"."calendar_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_notes" TO "service_role";



GRANT ALL ON TABLE "public"."dutch_pay_bills" TO "anon";
GRANT ALL ON TABLE "public"."dutch_pay_bills" TO "authenticated";
GRANT ALL ON TABLE "public"."dutch_pay_bills" TO "service_role";



GRANT ALL ON TABLE "public"."dutch_pay_members" TO "anon";
GRANT ALL ON TABLE "public"."dutch_pay_members" TO "authenticated";
GRANT ALL ON TABLE "public"."dutch_pay_members" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."participants" TO "anon";
GRANT ALL ON TABLE "public"."participants" TO "authenticated";
GRANT ALL ON TABLE "public"."participants" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."rooms" TO "anon";
GRANT ALL ON TABLE "public"."rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."rooms" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_time" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_time" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_time" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































