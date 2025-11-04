--
-- PostgreSQL database dump
--

\restrict xz534rXalmxznHY6Nxp2sXLHdOYlf464gg1X9UgBtQOD7R8eRlhOPOkdWZ7pDiS

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user',
    'super_admin',
    'business_owner'
);


ALTER TYPE public.app_role OWNER TO postgres;

--
-- Name: expense_category; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.expense_category AS ENUM (
    'rent',
    'utilities',
    'equipment',
    'salaries',
    'maintenance',
    'marketing',
    'insurance',
    'other'
);


ALTER TYPE public.expense_category OWNER TO postgres;

--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transaction_type AS ENUM (
    'enrollment_fee',
    'package_fee',
    'expense',
    'refund',
    'product_sale',
    'facility_rental'
);


ALTER TYPE public.transaction_type OWNER TO postgres;

--
-- Name: calculate_package_popularity(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_package_popularity(p_package_id uuid) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_club_id UUID;
  v_package_members INTEGER;
  v_total_members INTEGER;
  v_popularity NUMERIC;
BEGIN
  -- Get the club_id for this package
  SELECT club_id INTO v_club_id
  FROM public.club_packages
  WHERE id = p_package_id;

  -- Count active members in this specific package (not expired)
  SELECT COUNT(DISTINCT pe.member_id) INTO v_package_members
  FROM public.package_enrollments pe
  INNER JOIN public.club_packages cp ON pe.package_id = cp.id
  WHERE pe.package_id = p_package_id
    AND pe.is_active = true
    AND pe.enrolled_at + (cp.duration_months * INTERVAL '1 month') > NOW();

  -- Count total active members across all packages in the same club (not expired)
  SELECT COUNT(DISTINCT pe.member_id) INTO v_total_members
  FROM public.package_enrollments pe
  INNER JOIN public.club_packages cp ON pe.package_id = cp.id
  WHERE cp.club_id = v_club_id
    AND pe.is_active = true
    AND pe.enrolled_at + (cp.duration_months * INTERVAL '1 month') > NOW();

  -- Calculate percentage (avoid division by zero)
  IF v_total_members > 0 THEN
    v_popularity := (v_package_members::NUMERIC / v_total_members::NUMERIC) * 100;
  ELSE
    v_popularity := 0;
  END IF;

  RETURN ROUND(v_popularity, 0);
END;
$$;


ALTER FUNCTION public.calculate_package_popularity(p_package_id uuid) OWNER TO postgres;

--
-- Name: decrement_club_members_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.decrement_club_members_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Decrement if old member was active
  IF OLD.is_active = true THEN
    UPDATE public.clubs
    SET members_count = GREATEST(0, members_count - 1),
        updated_at = now()
    WHERE id = OLD.club_id;
  END IF;
  
  RETURN OLD;
END;
$$;


ALTER FUNCTION public.decrement_club_members_count() OWNER TO postgres;

--
-- Name: generate_receipt_number(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_receipt_number(p_club_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_prefix TEXT;
  v_last_number INT;
  v_new_number TEXT;
BEGIN
  SELECT receipt_code_prefix INTO v_prefix
  FROM public.clubs
  WHERE id = p_club_id;
  
  IF v_prefix IS NULL THEN
    v_prefix := 'REC';
  END IF;
  
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(receipt_number FROM '[0-9]+$') AS INT)),
    0
  ) INTO v_last_number
  FROM public.transaction_ledger
  WHERE club_id = p_club_id
    AND receipt_number IS NOT NULL;
  
  v_new_number := v_prefix || '-' || LPAD((v_last_number + 1)::TEXT, 5, '0');
  
  RETURN v_new_number;
END;
$_$;


ALTER FUNCTION public.generate_receipt_number(p_club_id uuid) OWNER TO postgres;

--
-- Name: get_registered_users_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_registered_users_count() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(*)::INTEGER FROM public.profiles;
$$;


ALTER FUNCTION public.get_registered_users_count() OWNER TO postgres;

--
-- Name: get_user_role_for_login(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_role_for_login(p_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = p_user_id
  ORDER BY CASE role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END
  LIMIT 1;
$$;


ALTER FUNCTION public.get_user_role_for_login(p_user_id uuid) OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    name,
    email,
    phone,
    country_code,
    date_of_birth,
    gender,
    nationality
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'country_code', '+1'),
    COALESCE((NEW.raw_user_meta_data->>'date_of_birth')::date, '2000-01-01'::date),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'male'),
    COALESCE(NEW.raw_user_meta_data->>'nationality', 'US')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


ALTER FUNCTION public.has_role(_user_id uuid, _role public.app_role) OWNER TO postgres;

--
-- Name: increment_club_members_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_club_members_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only increment if the new member is active
  IF NEW.is_active = true THEN
    UPDATE public.clubs
    SET members_count = members_count + 1,
        updated_at = now()
    WHERE id = NEW.club_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.increment_club_members_count() OWNER TO postgres;

--
-- Name: lookup_profile_for_login(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lookup_profile_for_login(identifier text) RETURNS TABLE(user_id uuid, avatar_url text, name text, email text, phone text, nationality text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
BEGIN
  -- Check if identifier looks like a phone number
  IF identifier ~ '^\+?[\d\s\-\(\)]+$' THEN
    -- Remove spaces and lookup by phone
    RETURN QUERY
    SELECT p.user_id, p.avatar_url, p.name, p.email, p.phone, p.nationality
    FROM public.profiles p
    WHERE p.phone = regexp_replace(identifier, '\s', '', 'g')
    LIMIT 1;
  -- Check if identifier looks like an email
  ELSIF identifier ~ '@' THEN
    -- Lookup by email
    RETURN QUERY
    SELECT p.user_id, p.avatar_url, p.name, p.email, p.phone, p.nationality
    FROM public.profiles p
    WHERE p.email ILIKE identifier
    LIMIT 1;
  ELSE
    -- Lookup by name (case-insensitive partial match)
    RETURN QUERY
    SELECT p.user_id, p.avatar_url, p.name, p.email, p.phone, p.nationality
    FROM public.profiles p
    WHERE p.name ILIKE '%' || identifier || '%'
    ORDER BY 
      -- Prioritize exact matches
      CASE WHEN LOWER(p.name) = LOWER(identifier) THEN 0 ELSE 1 END,
      -- Then by name length (shorter names first)
      LENGTH(p.name)
    LIMIT 5; -- Return up to 5 matches for name search
  END IF;
END;
$_$;


ALTER FUNCTION public.lookup_profile_for_login(identifier text) OWNER TO postgres;

--
-- Name: process_member_leave(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.process_member_leave(p_member_id uuid, p_leave_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_member record;
  v_history_id uuid;
  v_duration_days integer;
  v_skills jsonb := '[]'::jsonb;
  v_activity record;
BEGIN
  -- Get member details
  SELECT * INTO v_member
  FROM public.club_members
  WHERE id = p_member_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Member not found or already inactive');
  END IF;

  -- Calculate duration
  v_duration_days := CURRENT_DATE - v_member.joined_date;

  -- Create history record
  INSERT INTO public.membership_history (
    user_id,
    child_id,
    club_id,
    member_name,
    joined_date,
    left_date,
    duration_days,
    leave_reason
  ) VALUES (
    v_member.user_id,
    v_member.child_id,
    v_member.club_id,
    v_member.name,
    v_member.joined_date,
    CURRENT_DATE,
    v_duration_days,
    p_leave_reason
  )
  RETURNING id INTO v_history_id;

  -- Collect skills from enrolled packages
  FOR v_activity IN
    SELECT DISTINCT a.id, a.title, a.description
    FROM public.package_enrollments pe
    JOIN public.package_activities pa ON pe.package_id = pa.package_id
    JOIN public.activities a ON pa.activity_id = a.id
    WHERE pe.member_id = p_member_id
  LOOP
    -- Add activity skills to member's acquired skills
    INSERT INTO public.member_acquired_skills (
      membership_history_id,
      skill_name,
      skill_category,
      acquired_from_activity_id
    )
    SELECT
      v_history_id,
      COALESCE(ask.skill_name, v_activity.title),
      ask.skill_category,
      v_activity.id
    FROM public.activity_skills ask
    WHERE ask.activity_id = v_activity.id
    ON CONFLICT DO NOTHING;

    -- If no predefined skills, create from activity title
    IF NOT EXISTS (
      SELECT 1 FROM public.activity_skills WHERE activity_id = v_activity.id
    ) THEN
      INSERT INTO public.member_acquired_skills (
        membership_history_id,
        skill_name,
        acquired_from_activity_id
      ) VALUES (
        v_history_id,
        v_activity.title,
        v_activity.id
      );
    END IF;
  END LOOP;

  -- Deactivate package enrollments
  UPDATE public.package_enrollments
  SET is_active = false, updated_at = now()
  WHERE member_id = p_member_id;

  -- Update member status (trigger will handle club count decrement)
  UPDATE public.club_members
  SET 
    is_active = false,
    left_date = CURRENT_DATE,
    leave_reason = p_leave_reason,
    updated_at = now()
  WHERE id = p_member_id;

  -- Get skills for response
  SELECT jsonb_agg(
    jsonb_build_object(
      'skill_name', skill_name,
      'skill_category', skill_category
    )
  ) INTO v_skills
  FROM public.member_acquired_skills
  WHERE membership_history_id = v_history_id;

  RETURN jsonb_build_object(
    'success', true,
    'history_id', v_history_id,
    'duration_days', v_duration_days,
    'skills_acquired', COALESCE(v_skills, '[]'::jsonb)
  );
END;
$$;


ALTER FUNCTION public.process_member_leave(p_member_id uuid, p_leave_reason text) OWNER TO postgres;

--
-- Name: recalculate_all_package_popularity(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.recalculate_all_package_popularity() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.club_packages
  SET popularity = public.calculate_package_popularity(id);
END;
$$;


ALTER FUNCTION public.recalculate_all_package_popularity() OWNER TO postgres;

--
-- Name: update_club_members_count_on_status_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_club_members_count_on_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- If status changed from active to inactive, decrement
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE public.clubs
    SET members_count = GREATEST(0, members_count - 1),
        updated_at = now()
    WHERE id = NEW.club_id;
  END IF;
  
  -- If status changed from inactive to active, increment
  IF OLD.is_active = false AND NEW.is_active = true THEN
    UPDATE public.clubs
    SET members_count = members_count + 1,
        updated_at = now()
    WHERE id = NEW.club_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_club_members_count_on_status_change() OWNER TO postgres;

--
-- Name: update_conversation_last_message(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_conversation_last_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_conversation_last_message() OWNER TO postgres;

--
-- Name: update_package_popularity(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_package_popularity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_club_id UUID;
BEGIN
  -- Get club_id from the package
  SELECT club_id INTO v_club_id
  FROM public.club_packages
  WHERE id = COALESCE(NEW.package_id, OLD.package_id);

  -- Update popularity for all packages in this club
  UPDATE public.club_packages
  SET popularity = public.calculate_package_popularity(id)
  WHERE club_id = v_club_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.update_package_popularity() OWNER TO postgres;

--
-- Name: update_transaction_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_transaction_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_transaction_updated_at() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    club_facility_id uuid NOT NULL,
    title text NOT NULL,
    monthly_fee numeric(10,2) NOT NULL,
    sessions_per_week integer DEFAULT 1 NOT NULL,
    notes text,
    picture_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    duration_minutes integer DEFAULT 60,
    max_capacity integer,
    cost_per_session numeric,
    booking_enabled boolean DEFAULT true,
    requires_prebooking boolean DEFAULT false,
    CONSTRAINT positive_fee CHECK ((monthly_fee >= (0)::numeric)),
    CONSTRAINT positive_sessions CHECK ((sessions_per_week > 0))
);


ALTER TABLE public.activities OWNER TO postgres;

--
-- Name: activity_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    activity_id uuid NOT NULL,
    day_of_week text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    notes text,
    CONSTRAINT valid_day CHECK ((day_of_week = ANY (ARRAY['monday'::text, 'tuesday'::text, 'wednesday'::text, 'thursday'::text, 'friday'::text, 'saturday'::text, 'sunday'::text]))),
    CONSTRAINT valid_time_range CHECK ((end_time > start_time))
);


ALTER TABLE public.activity_schedules OWNER TO postgres;

--
-- Name: activity_skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    activity_id uuid NOT NULL,
    skill_name text NOT NULL,
    skill_category text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.activity_skills OWNER TO postgres;

--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    bank_name text NOT NULL,
    account_name text NOT NULL,
    account_number_encrypted text NOT NULL,
    iban_encrypted text,
    swift_code_encrypted text,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.bank_accounts OWNER TO postgres;

--
-- Name: children; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.children (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_user_id uuid NOT NULL,
    name text NOT NULL,
    gender text NOT NULL,
    date_of_birth date NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    blood_type text,
    nationality text DEFAULT 'Unknown'::text NOT NULL,
    CONSTRAINT children_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text])))
);


ALTER TABLE public.children OWNER TO postgres;

--
-- Name: COLUMN children.blood_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.children.blood_type IS 'Blood type of the child (A+, A-, B+, B-, AB+, AB-, O+, O-)';


--
-- Name: club_amenities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.club_amenities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    name text NOT NULL,
    icon text NOT NULL,
    available boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.club_amenities OWNER TO postgres;

--
-- Name: club_classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.club_classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    instructor_id uuid,
    name text NOT NULL,
    "time" text NOT NULL,
    duration integer DEFAULT 60,
    available boolean DEFAULT true,
    max_capacity integer DEFAULT 20,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    gender_restriction text DEFAULT 'mixed'::text
);


ALTER TABLE public.club_classes OWNER TO postgres;

--
-- Name: club_community_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.club_community_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    author_name text NOT NULL,
    author_avatar text,
    content text NOT NULL,
    likes_count integer DEFAULT 0,
    comments_count integer DEFAULT 0,
    posted_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.club_community_posts OWNER TO postgres;

--
-- Name: club_facilities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.club_facilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    latitude numeric(10,8) NOT NULL,
    longitude numeric(11,8) NOT NULL,
    is_rentable boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    is_available boolean DEFAULT true,
    map_zoom integer DEFAULT 13
);


ALTER TABLE public.club_facilities OWNER TO postgres;

--
-- Name: club_instructors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.club_instructors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    name text NOT NULL,
    specialty text NOT NULL,
    rating numeric(2,1) DEFAULT 4.5,
    experience text NOT NULL,
    bio text,
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    achievements text,
    certifications text,
    credentials text,
    specialty_tags text[] DEFAULT '{}'::text[],
    link_tree jsonb DEFAULT '[]'::jsonb,
    member_id uuid,
    club_rating numeric(3,2),
    offers_personal_training boolean DEFAULT false,
    CONSTRAINT club_instructors_club_rating_check CHECK (((club_rating >= (0)::numeric) AND (club_rating <= (5)::numeric)))
);


ALTER TABLE public.club_instructors OWNER TO postgres;

--
-- Name: COLUMN club_instructors.member_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.club_instructors.member_id IS 'Links instructor to their club_members record for membership tracking';


--
-- Name: COLUMN club_instructors.club_rating; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.club_instructors.club_rating IS 'Club admin rating of instructor performance (0-5)';


--
-- Name: COLUMN club_instructors.offers_personal_training; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.club_instructors.offers_personal_training IS 'Whether instructor offers personal training sessions outside scheduled club hours';


--
-- Name: club_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.club_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid,
    name text NOT NULL,
    avatar_url text,
    rank text NOT NULL,
    achievements integer DEFAULT 0,
    joined_date date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    child_id uuid,
    left_date date,
    is_active boolean DEFAULT true,
    leave_reason text,
    is_instructor boolean DEFAULT false,
    payment_screenshot_url text,
    CONSTRAINT member_type_check CHECK ((((user_id IS NOT NULL) AND (child_id IS NULL)) OR ((user_id IS NULL) AND (child_id IS NOT NULL))))
);


ALTER TABLE public.club_members OWNER TO postgres;

--
-- Name: COLUMN club_members.is_instructor; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.club_members.is_instructor IS 'Indicates if this member serves as an instructor for the club';


--
-- Name: club_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.club_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    name text NOT NULL,
    price numeric(10,2) NOT NULL,
    duration_months integer NOT NULL,
    is_popular boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    popularity integer DEFAULT 0,
    activity_type text DEFAULT 'single'::text,
    age_min integer,
    age_max integer,
    gender_restriction text DEFAULT 'mixed'::text,
    picture_url text,
    duration_type text DEFAULT 'duration'::text,
    session_count integer,
    discount_code text,
    discount_percentage numeric DEFAULT 0,
    start_date date,
    end_date date,
    booking_enabled boolean DEFAULT true,
    max_bookings integer,
    description text,
    CONSTRAINT valid_age_range CHECK (((age_min IS NULL) OR (age_max IS NULL) OR (age_max >= age_min))),
    CONSTRAINT valid_duration_type CHECK ((duration_type = ANY (ARRAY['duration'::text, 'session'::text]))),
    CONSTRAINT valid_gender CHECK ((gender_restriction = ANY (ARRAY['mixed'::text, 'male'::text, 'female'::text])))
);


ALTER TABLE public.club_packages OWNER TO postgres;

--
-- Name: club_partners; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.club_partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    discount_text text,
    logo_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    category text,
    terms text,
    requirements text,
    contact_info jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.club_partners OWNER TO postgres;

--
-- Name: COLUMN club_partners.category; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.club_partners.category IS 'Category of partner business: shop, nutrition, physiotherapy, supplements, venues, food_plans';


--
-- Name: club_pictures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.club_pictures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    image_url text NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    description text
);


ALTER TABLE public.club_pictures OWNER TO postgres;

--
-- Name: club_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.club_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    category text NOT NULL,
    image_url text,
    in_stock boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.club_products OWNER TO postgres;

--
-- Name: club_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.club_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid,
    reviewer_name text NOT NULL,
    rating integer NOT NULL,
    comment text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT club_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.club_reviews OWNER TO postgres;

--
-- Name: club_statistics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.club_statistics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    total_workouts integer DEFAULT 0,
    active_members integer DEFAULT 0,
    calories_burned bigint DEFAULT 0,
    average_session_minutes integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.club_statistics OWNER TO postgres;

--
-- Name: clubs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clubs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    location text,
    rating numeric(2,1) DEFAULT 0,
    members_count integer DEFAULT 0,
    classes_count integer DEFAULT 0,
    trainers_count integer DEFAULT 0,
    peak_hours text,
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    welcoming_message text,
    gps_latitude numeric,
    gps_longitude numeric,
    link_tree jsonb DEFAULT '[]'::jsonb,
    logo_url text,
    owner_name text,
    owner_contact text,
    owner_email text,
    slogan text,
    slogan_explanation text,
    club_email text,
    club_phone text,
    currency text DEFAULT 'USD'::text,
    timezone text DEFAULT 'UTC'::text,
    club_slug text,
    opening_hours jsonb DEFAULT '[]'::jsonb,
    bank_name text,
    bank_account_name text,
    bank_account_number text,
    bank_iban text,
    bank_swift_code text,
    member_code_prefix text DEFAULT 'MEM'::text,
    invoice_code_prefix text DEFAULT 'INV'::text,
    receipt_code_prefix text DEFAULT 'REC'::text,
    expense_code_prefix text DEFAULT 'EXP'::text,
    specialist_code_prefix text DEFAULT 'SPEC'::text,
    favicon_url text,
    club_phone_code text,
    owner_contact_code text,
    enrollment_fee numeric DEFAULT 0,
    child_code_prefix text DEFAULT 'CHILD'::text,
    commercial_registration_number text,
    vat_registration_number text,
    vat_percentage numeric DEFAULT 0,
    map_zoom integer DEFAULT 13,
    business_owner_id uuid,
    country_iso text
);


ALTER TABLE public.clubs OWNER TO postgres;

--
-- Name: COLUMN clubs.country_iso; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clubs.country_iso IS 'ISO 3166-1 alpha-2 country code (e.g., US, AE, GB)';


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text,
    last_message_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: facility_operating_hours; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.facility_operating_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_facility_id uuid NOT NULL,
    day_of_week text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.facility_operating_hours OWNER TO postgres;

--
-- Name: facility_pictures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.facility_pictures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_facility_id uuid NOT NULL,
    image_url text NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.facility_pictures OWNER TO postgres;

--
-- Name: facility_rentable_times; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.facility_rentable_times (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_facility_id uuid NOT NULL,
    day_of_week text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_day CHECK ((day_of_week = ANY (ARRAY['monday'::text, 'tuesday'::text, 'wednesday'::text, 'thursday'::text, 'friday'::text, 'saturday'::text, 'sunday'::text])))
);


ALTER TABLE public.facility_rentable_times OWNER TO postgres;

--
-- Name: instructor_certifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.instructor_certifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instructor_id uuid NOT NULL,
    certificate_name text NOT NULL,
    certificate_image_url text,
    awarded_date date NOT NULL,
    issuing_organization text NOT NULL,
    description text,
    certificate_number text,
    expiry_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.instructor_certifications OWNER TO postgres;

--
-- Name: instructor_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.instructor_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instructor_id uuid NOT NULL,
    member_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT instructor_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.instructor_reviews OWNER TO postgres;

--
-- Name: member_acquired_skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_acquired_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    membership_history_id uuid NOT NULL,
    skill_name text NOT NULL,
    skill_category text,
    acquired_from_activity_id uuid,
    acquired_date date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.member_acquired_skills OWNER TO postgres;

--
-- Name: membership_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.membership_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    child_id uuid,
    club_id uuid NOT NULL,
    member_name text NOT NULL,
    joined_date date NOT NULL,
    left_date date NOT NULL,
    duration_days integer NOT NULL,
    leave_reason text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT membership_history_user_or_child CHECK ((((user_id IS NOT NULL) AND (child_id IS NULL)) OR ((user_id IS NULL) AND (child_id IS NOT NULL))))
);


ALTER TABLE public.membership_history OWNER TO postgres;

--
-- Name: membership_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.membership_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    club_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT membership_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


ALTER TABLE public.membership_requests OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    sender_type text NOT NULL,
    content text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['user'::text, 'club_admin'::text, 'system'::text])))
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    club_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    action_url text,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['membership_approved'::text, 'membership_request'::text, 'package_expiring'::text, 'new_message'::text, 'system_alert'::text, 'announcement'::text, 'class_cancelled'::text])))
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: package_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.package_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    package_id uuid NOT NULL,
    class_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    activity_id uuid,
    instructor_id uuid
);


ALTER TABLE public.package_activities OWNER TO postgres;

--
-- Name: package_enrollments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.package_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    package_id uuid NOT NULL,
    member_id uuid NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    package_price_version_id uuid,
    enrollment_transaction_id uuid,
    package_transaction_id uuid
);


ALTER TABLE public.package_enrollments OWNER TO postgres;

--
-- Name: package_price_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.package_price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    package_id uuid NOT NULL,
    price numeric(10,2) NOT NULL,
    vat_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    valid_from timestamp with time zone DEFAULT now() NOT NULL,
    valid_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


ALTER TABLE public.package_price_history OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    avatar_url text,
    phone text NOT NULL,
    country_code text NOT NULL,
    date_of_birth date NOT NULL,
    gender text NOT NULL,
    nationality text NOT NULL,
    address text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    blood_type text,
    email text,
    CONSTRAINT profiles_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text])))
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: COLUMN profiles.blood_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.blood_type IS 'Blood type of the user (A+, A-, B+, B-, AB+, AB-, O+, O-)';


--
-- Name: transaction_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transaction_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    changed_by uuid NOT NULL,
    changed_at timestamp with time zone DEFAULT now(),
    change_type text NOT NULL,
    previous_values jsonb,
    new_values jsonb,
    notes text,
    CONSTRAINT transaction_history_change_type_check CHECK ((change_type = ANY (ARRAY['created'::text, 'updated'::text, 'approved'::text, 'rejected'::text, 'refunded'::text])))
);


ALTER TABLE public.transaction_history OWNER TO postgres;

--
-- Name: transaction_ledger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transaction_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    transaction_type public.transaction_type NOT NULL,
    category public.expense_category,
    description text NOT NULL,
    amount numeric(10,2) NOT NULL,
    vat_amount numeric(10,2) DEFAULT 0 NOT NULL,
    vat_percentage_applied numeric(5,2) DEFAULT 0 NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    payment_method text,
    payment_screenshot_url text,
    receipt_number text,
    member_id uuid,
    package_price_version_id uuid,
    enrollment_id uuid,
    reference_id uuid,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    notes text,
    payment_status text DEFAULT 'paid'::text,
    payment_proof_url text,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejection_reason text,
    is_refund boolean DEFAULT false,
    refund_amount numeric,
    refunded_transaction_id uuid,
    refund_proof_url text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    version integer DEFAULT 1,
    change_history jsonb DEFAULT '[]'::jsonb,
    member_name text,
    member_email text,
    member_phone text,
    CONSTRAINT transaction_ledger_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT transaction_ledger_payment_status_check CHECK ((payment_status = ANY (ARRAY['paid'::text, 'pending'::text, 'rejected'::text]))),
    CONSTRAINT transaction_ledger_total_amount_check CHECK ((total_amount >= (0)::numeric)),
    CONSTRAINT transaction_ledger_vat_amount_check CHECK ((vat_amount >= (0)::numeric))
);


ALTER TABLE public.transaction_ledger OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Data for Name: activities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activities (id, club_id, club_facility_id, title, monthly_fee, sessions_per_week, notes, picture_url, created_at, updated_at, description, duration_minutes, max_capacity, cost_per_session, booking_enabled, requires_prebooking) FROM stdin;
7c86302d-4b0d-46ad-a6a0-3acd45a4d025	7a7643d1-15c5-4750-8f21-dcec5179f82d	842d7a64-a4a8-43ae-8eef-7359a604960d	TAEKWONDO - CLASS A	30.00	3	\N	\N	2025-10-17 19:40:13.105057+00	2025-10-17 19:40:13.105057+00	\N	60	\N	2.5	f	f
16512cae-942a-427d-9d34-09f618141183	7a7643d1-15c5-4750-8f21-dcec5179f82d	842d7a64-a4a8-43ae-8eef-7359a604960d	TAEKWONDO - CLASS C	30.00	3	\N	\N	2025-10-17 19:41:57.529902+00	2025-10-17 19:41:57.529902+00	\N	60	\N	2.5	f	f
b9eccf70-cc83-4124-9468-20d7646443c9	7a7643d1-15c5-4750-8f21-dcec5179f82d	842d7a64-a4a8-43ae-8eef-7359a604960d	TAEKWONDO - CLASS B	30.00	3	\N	\N	2025-10-17 19:41:11.536273+00	2025-10-17 19:41:11.536273+00	\N	60	\N	2.5	f	f
4541b920-6b36-4459-b7cb-c3f714e1d3ec	7a7643d1-15c5-4750-8f21-dcec5179f82d	842d7a64-a4a8-43ae-8eef-7359a604960d	TAEKWONDO - CLASS D	30.00	3	\N	\N	2025-10-17 19:42:36.100062+00	2025-10-17 19:43:04.309369+00	\N	60	\N	2.5	f	f
de79344c-3e12-4b40-b5da-8fd7706309ce	fb19b81e-1874-4451-8193-9429d637efc8	f367e4cd-d41e-49a7-ba0e-317337f34952	TAEKWONDO - CLASS A	30.00	3	\N	\N	2025-10-15 21:25:18.09242+00	2025-10-15 21:25:18.09242+00	\N	60	\N	3	t	f
3fe85c39-4d2c-461e-a578-98fa35ae6e7e	fb19b81e-1874-4451-8193-9429d637efc8	f367e4cd-d41e-49a7-ba0e-317337f34952	TAEKWONDO - CLASS C	30.00	3	\N	\N	2025-10-15 21:28:01.003632+00	2025-10-15 21:28:01.003632+00	\N	60	\N	3	t	f
02a4737f-a194-4e83-ba60-32f7b893a783	fb19b81e-1874-4451-8193-9429d637efc8	f367e4cd-d41e-49a7-ba0e-317337f34952	TAEKWONDO - CLASS B	30.00	3	\N	\N	2025-10-15 21:26:16.620032+00	2025-10-15 21:26:16.620032+00	\N	60	\N	3	t	f
fde2d182-3206-402b-841d-cd5241ecdeff	fb19b81e-1874-4451-8193-9429d637efc8	f367e4cd-d41e-49a7-ba0e-317337f34952	TAEKWONDO - CLASS D	30.00	3	\N	\N	2025-10-15 21:28:49.299418+00	2025-10-15 21:28:49.299418+00	\N	60	\N	3	t	f
2d72f34f-27ad-49af-a9e7-9e5fac8c5cce	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	095e0b27-d269-413f-a057-5c3b227643fd	TAEKWONDO (S.M.W) CLASS A	35.00	3	\N	\N	2025-10-15 18:33:57.162888+00	2025-10-16 04:31:20.775223+00	\N	60	\N	3	f	f
0576d84c-ea0e-4082-8a52-112a86d1b7fe	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	095e0b27-d269-413f-a057-5c3b227643fd	TAEKWONDO (S.M.W) CLASS B	35.00	3	\N	\N	2025-10-15 20:04:09.150938+00	2025-10-16 04:31:29.387663+00	\N	60	\N	3	f	f
e30baffd-ed4d-4c96-887d-d87473c7c0a5	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	095e0b27-d269-413f-a057-5c3b227643fd	TAEKWONDO (S.M.W) CLASS C	35.00	3	\N	\N	2025-10-15 20:04:55.30354+00	2025-10-16 04:31:36.335137+00	\N	60	\N	3	f	f
a347850a-6479-4f0b-8a6f-54eabe26e6c2	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	095e0b27-d269-413f-a057-5c3b227643fd	TAEKWONDO (S.M.W) CLASS D	35.00	3	\N	\N	2025-10-15 20:07:08.690219+00	2025-10-16 04:31:44.116319+00	\N	90	\N	3	f	f
335a50f9-3760-476d-82bb-416dd008ae54	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	095e0b27-d269-413f-a057-5c3b227643fd	TAEKWONDO (S.T.T) CLASS A	35.00	3	\N	\N	2025-10-15 20:11:13.030325+00	2025-10-16 04:31:51.469998+00	\N	60	\N	3	f	f
c867435b-24c5-4529-9bc2-8fa9928ac1bb	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	095e0b27-d269-413f-a057-5c3b227643fd	TAEKWONDO (S.T.T) CLASS B	35.00	3	\N	\N	2025-10-15 20:11:58.13864+00	2025-10-16 04:31:57.362871+00	\N	60	\N	3	f	f
56204342-7612-490a-ab90-870e2175d5f3	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	095e0b27-d269-413f-a057-5c3b227643fd	TAEKWONDO (S.T.T) CLASS C	35.00	3	\N	\N	2025-10-15 20:13:00.037773+00	2025-10-16 04:32:05.312493+00	\N	60	\N	3	f	f
35c36113-7081-4127-ad92-44a9378fc94a	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	095e0b27-d269-413f-a057-5c3b227643fd	TAEKWONDO (S.T.T) CLASS D	35.00	3	\N	\N	2025-10-15 20:15:23.622164+00	2025-10-16 04:32:11.465804+00	\N	60	\N	3	f	f
d9bb5f9d-1f5b-4665-a330-0e9ff5455842	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	095e0b27-d269-413f-a057-5c3b227643fd	TAEKWONDO (S.T.T) CLASS E	35.00	3	\N	\N	2025-10-15 20:17:17.971802+00	2025-10-16 04:32:17.851902+00	\N	90	\N	3	f	f
\.


--
-- Data for Name: activity_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_schedules (id, activity_id, day_of_week, start_time, end_time, created_at, notes) FROM stdin;
790538ab-4bdf-473e-a877-9ccd3981c5fc	7c86302d-4b0d-46ad-a6a0-3acd45a4d025	saturday	16:30:00	17:30:00	2025-10-17 19:40:13.31977+00	\N
ee3fe87e-181f-4570-b866-2804c0062b03	7c86302d-4b0d-46ad-a6a0-3acd45a4d025	monday	16:30:00	17:30:00	2025-10-17 19:40:13.31977+00	\N
f4ffc229-dd4f-4058-b6ab-1bb4cc5a1b04	7c86302d-4b0d-46ad-a6a0-3acd45a4d025	wednesday	16:30:00	17:30:00	2025-10-17 19:40:13.31977+00	\N
abab2c20-b9fc-47e6-95b1-094e1bb46755	16512cae-942a-427d-9d34-09f618141183	sunday	17:30:00	18:30:00	2025-10-17 19:41:58.346656+00	\N
471dc338-163e-4a1d-b679-7d0631f554fb	16512cae-942a-427d-9d34-09f618141183	tuesday	17:30:00	18:30:00	2025-10-17 19:41:58.346656+00	\N
a61ca3da-3c33-4fcd-a5c8-641b0dac6ebc	16512cae-942a-427d-9d34-09f618141183	thursday	17:30:00	18:30:00	2025-10-17 19:41:58.346656+00	\N
f2a8f813-00a3-4a04-8ce9-085ea2db5c69	b9eccf70-cc83-4124-9468-20d7646443c9	saturday	17:30:00	18:30:00	2025-10-17 19:41:11.733244+00	\N
574e8f5e-f52e-4115-8596-592af7aaf0cd	b9eccf70-cc83-4124-9468-20d7646443c9	monday	17:30:00	18:30:00	2025-10-17 19:41:11.733244+00	\N
8878e1f4-6a6a-450f-883a-96bf56fa665b	b9eccf70-cc83-4124-9468-20d7646443c9	wednesday	17:30:00	18:30:00	2025-10-17 19:41:11.733244+00	\N
0caa25f1-6057-4651-8df3-dc1f5039012e	35c36113-7081-4127-ad92-44a9378fc94a	sunday	19:00:00	20:00:00	2025-10-15 20:15:23.794711+00	\N
d3699b89-4c6d-442a-ad66-2c32e5721406	4541b920-6b36-4459-b7cb-c3f714e1d3ec	sunday	18:30:00	19:30:00	2025-10-17 19:42:36.322407+00	\N
2ae5e0f3-7bb2-4cb4-a7b8-5d9c6da6e3b8	35c36113-7081-4127-ad92-44a9378fc94a	tuesday	19:00:00	20:00:00	2025-10-15 20:15:23.794711+00	\N
4403c200-7b77-4dc9-96ca-94085abac479	35c36113-7081-4127-ad92-44a9378fc94a	thursday	19:00:00	20:00:00	2025-10-15 20:15:23.794711+00	\N
73c11ed8-e448-4e01-b811-a0c7f33df8e9	02a4737f-a194-4e83-ba60-32f7b893a783	saturday	17:30:00	18:30:00	2025-10-15 21:26:16.795842+00	\N
52922e65-c786-4964-9454-635f70bfce42	02a4737f-a194-4e83-ba60-32f7b893a783	monday	17:30:00	18:30:00	2025-10-15 21:26:16.795842+00	\N
64eade44-b983-4af3-95f3-6e436d665071	02a4737f-a194-4e83-ba60-32f7b893a783	wednesday	17:30:00	18:30:00	2025-10-15 21:26:16.795842+00	\N
287cebc0-123e-4e78-9d29-7d3531cbc656	2d72f34f-27ad-49af-a9e7-9e5fac8c5cce	saturday	16:00:00	17:00:00	2025-10-15 19:58:21.02415+00	\N
d7d94fde-dbdd-4b0b-a844-c3e7080c4439	0576d84c-ea0e-4082-8a52-112a86d1b7fe	saturday	17:00:00	18:00:00	2025-10-15 20:04:09.352644+00	\N
90f3ae9e-6e3b-4a8b-9b45-bb14c9e86e23	0576d84c-ea0e-4082-8a52-112a86d1b7fe	monday	17:00:00	18:00:00	2025-10-15 20:04:09.352644+00	\N
97a9fbe9-e49c-4448-8fa4-5738feec046a	0576d84c-ea0e-4082-8a52-112a86d1b7fe	wednesday	17:00:00	18:00:00	2025-10-15 20:04:09.352644+00	\N
f26666ed-adfc-4c6b-ab31-bef40ba72ba7	335a50f9-3760-476d-82bb-416dd008ae54	sunday	16:00:00	17:00:00	2025-10-15 20:11:13.189788+00	\N
83b6de67-6337-42bc-b287-eaffccc37738	335a50f9-3760-476d-82bb-416dd008ae54	tuesday	16:00:00	17:00:00	2025-10-15 20:11:13.189788+00	\N
fc03b342-a781-4f03-b7ea-ae5495ce702d	335a50f9-3760-476d-82bb-416dd008ae54	thursday	16:00:00	17:00:00	2025-10-15 20:11:13.189788+00	\N
ecbbf2d9-b151-4612-a56b-948c969a9e5b	d9bb5f9d-1f5b-4665-a330-0e9ff5455842	sunday	20:00:00	21:30:00	2025-10-15 20:17:18.132457+00	\N
fc221f92-bc22-402c-8a56-1fdaae3d0711	4541b920-6b36-4459-b7cb-c3f714e1d3ec	tuesday	18:30:00	19:30:00	2025-10-17 19:42:36.322407+00	\N
66dbb22c-aad2-4d31-8401-b338331885e2	4541b920-6b36-4459-b7cb-c3f714e1d3ec	thursday	18:30:00	19:30:00	2025-10-17 19:42:36.322407+00	\N
646cf742-213f-4ea8-bc34-5fcdbe967110	d9bb5f9d-1f5b-4665-a330-0e9ff5455842	tuesday	20:00:00	21:30:00	2025-10-15 20:17:18.132457+00	\N
7ffa0de1-5926-4d22-9e36-3297c5301aa2	d9bb5f9d-1f5b-4665-a330-0e9ff5455842	thursday	20:00:00	21:30:00	2025-10-15 20:17:18.132457+00	\N
57ad2106-9a9b-45c7-b586-6a391ca22e9e	3fe85c39-4d2c-461e-a578-98fa35ae6e7e	sunday	17:30:00	18:30:00	2025-10-15 21:28:01.172757+00	\N
f2ce15b1-b3e2-4f4d-85b4-c768446e5fc1	3fe85c39-4d2c-461e-a578-98fa35ae6e7e	tuesday	17:30:00	18:30:00	2025-10-15 21:28:01.172757+00	\N
a7a18138-5727-4b98-a536-58fd16f6f820	3fe85c39-4d2c-461e-a578-98fa35ae6e7e	tuesday	17:30:00	18:30:00	2025-10-15 21:28:01.172757+00	\N
48d24684-fa63-4d28-a877-b93018218389	2d72f34f-27ad-49af-a9e7-9e5fac8c5cce	monday	16:00:00	17:00:00	2025-10-15 19:58:29.551351+00	\N
0c51f96c-8922-489b-843d-3b5d5f034d85	e30baffd-ed4d-4c96-887d-d87473c7c0a5	saturday	19:00:00	20:00:00	2025-10-15 20:04:55.746469+00	\N
203cfdee-1b96-43ff-934b-f5a7ebbcde45	e30baffd-ed4d-4c96-887d-d87473c7c0a5	monday	19:00:00	20:00:00	2025-10-15 20:04:55.746469+00	\N
fb6621c8-169d-430d-8d40-23fa3e461307	e30baffd-ed4d-4c96-887d-d87473c7c0a5	wednesday	19:00:00	20:00:00	2025-10-15 20:04:55.746469+00	\N
d10d5d7a-51ec-461a-90e3-c456031b9907	c867435b-24c5-4529-9bc2-8fa9928ac1bb	sunday	17:00:00	18:00:00	2025-10-15 20:11:58.317012+00	\N
765eaa42-2081-4b7b-97c9-8bc89a72070c	c867435b-24c5-4529-9bc2-8fa9928ac1bb	tuesday	17:00:00	18:00:00	2025-10-15 20:11:58.317012+00	\N
092e77e0-c0af-47dc-b96d-b13dc904fd55	c867435b-24c5-4529-9bc2-8fa9928ac1bb	thursday	17:00:00	18:00:00	2025-10-15 20:11:58.317012+00	\N
9a7fbed8-5455-402a-940e-9e9fbbfb608c	de79344c-3e12-4b40-b5da-8fd7706309ce	saturday	16:30:00	17:30:00	2025-10-15 21:25:18.35585+00	\N
3c68a1ee-ec6f-48cc-9719-8635a6b42281	de79344c-3e12-4b40-b5da-8fd7706309ce	monday	16:30:00	17:30:00	2025-10-15 21:25:18.35585+00	\N
8ceaa4dc-e1a4-4fd7-83d4-3dff68cd2774	de79344c-3e12-4b40-b5da-8fd7706309ce	wednesday	16:30:00	17:30:00	2025-10-15 21:25:18.35585+00	\N
ca5fcd76-0015-490b-b82b-454a4aed2611	fde2d182-3206-402b-841d-cd5241ecdeff	sunday	18:30:00	19:30:00	2025-10-15 21:28:49.465586+00	\N
74949720-e3c2-4db4-8d20-694aaeef96d4	fde2d182-3206-402b-841d-cd5241ecdeff	tuesday	18:30:00	19:30:00	2025-10-15 21:28:49.465586+00	\N
3e88927d-664e-47b8-aac3-c9e9766797f3	fde2d182-3206-402b-841d-cd5241ecdeff	tuesday	18:30:00	19:30:00	2025-10-15 21:28:49.465586+00	\N
af76710d-884f-468e-88b7-d306feb51041	2d72f34f-27ad-49af-a9e7-9e5fac8c5cce	wednesday	16:00:00	17:00:00	2025-10-15 19:58:35.340141+00	\N
efe3a333-b4eb-4fda-a2b5-d24445931d87	a347850a-6479-4f0b-8a6f-54eabe26e6c2	saturday	20:00:00	21:30:00	2025-10-15 20:07:08.848032+00	\N
38d342fd-9d10-452c-a970-7a81312297c6	a347850a-6479-4f0b-8a6f-54eabe26e6c2	monday	20:00:00	21:30:00	2025-10-15 20:07:08.848032+00	\N
24b5c8a2-8fe7-421b-8d8c-40fd02529bc6	a347850a-6479-4f0b-8a6f-54eabe26e6c2	wednesday	20:00:00	21:30:00	2025-10-15 20:07:08.848032+00	\N
46537522-efa0-419c-8a9c-5d2c78658e84	56204342-7612-490a-ab90-870e2175d5f3	sunday	18:00:00	19:00:00	2025-10-15 20:13:00.304773+00	\N
bb157b04-3281-465d-a7b1-f72a5398a74f	56204342-7612-490a-ab90-870e2175d5f3	tuesday	18:00:00	19:00:00	2025-10-15 20:13:00.304773+00	\N
2929b64e-8685-418d-afec-033e3da8e76e	56204342-7612-490a-ab90-870e2175d5f3	thursday	18:00:00	19:00:00	2025-10-15 20:13:00.304773+00	\N
\.


--
-- Data for Name: activity_skills; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_skills (id, activity_id, skill_name, skill_category, created_at) FROM stdin;
\.


--
-- Data for Name: bank_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bank_accounts (id, club_id, bank_name, account_name, account_number_encrypted, iban_encrypted, swift_code_encrypted, is_primary, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: children; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.children (id, parent_user_id, name, gender, date_of_birth, avatar_url, created_at, updated_at, blood_type, nationality) FROM stdin;
b58cb0ed-c095-4b58-9bc6-a40fce9f4001	3f9a5abf-a9c8-46de-ad7f-0466a8c1e054	Ayoob Ghassan Mohamed	male	2020-06-04	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760714470479.png	2025-10-17 09:48:49.849405+00	2025-10-17 15:23:37.672301+00	dont_know	Bahrain
c9f30e02-887a-4f28-b93f-105bdcac6ea9	3f9a5abf-a9c8-46de-ad7f-0466a8c1e054	Mohamed Ghassan Mohammed	male	2015-02-17	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/child-1760758196623.png	2025-10-18 03:30:29.686855+00	2025-10-18 03:30:29.686855+00	dont_know	BH
cb4748a6-0523-484a-a3ee-7be6d2a9a395	3f9a5abf-a9c8-46de-ad7f-0466a8c1e054	Zahra Ghassan Mohamed	female	2022-09-19	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/child-1760758334390.jpg	2025-10-18 03:33:25.269823+00	2025-10-18 03:33:25.269823+00	dont_know	BH
\.


--
-- Data for Name: club_amenities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.club_amenities (id, club_id, name, icon, available, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: club_classes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.club_classes (id, club_id, instructor_id, name, "time", duration, available, max_capacity, created_at, updated_at, gender_restriction) FROM stdin;
\.


--
-- Data for Name: club_community_posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.club_community_posts (id, club_id, author_name, author_avatar, content, likes_count, comments_count, posted_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: club_facilities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.club_facilities (id, club_id, name, address, latitude, longitude, is_rentable, created_at, updated_at, description, is_available, map_zoom) FROM stdin;
095e0b27-d269-413f-a057-5c3b227643fd	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	Main Hall	Road 1238, Dar Kulayb, Northern Governorate, Bahrain	26.09205393	50.51200390	f	2025-10-15 18:31:12.185224+00	2025-10-15 18:31:12.185224+00	\N	t	16
f367e4cd-d41e-49a7-ba0e-317337f34952	fb19b81e-1874-4451-8193-9429d637efc8	Main Hall	Road 3624, المدينة الشمالية, Northern Governorate, Bahrain	26.21653532	50.47044039	f	2025-10-15 19:06:41.130328+00	2025-10-15 19:06:41.130328+00	\N	t	16
842d7a64-a4a8-43ae-8eef-7359a604960d	7a7643d1-15c5-4750-8f21-dcec5179f82d	Main Hall	Avenue 73, Manama, Capital Governorate, Bahrain	26.20065271	50.56716084	f	2025-10-17 19:38:49.244026+00	2025-10-17 19:38:49.244026+00	\N	t	17
\.


--
-- Data for Name: club_instructors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.club_instructors (id, club_id, name, specialty, rating, experience, bio, image_url, created_at, updated_at, achievements, certifications, credentials, specialty_tags, link_tree, member_id, club_rating, offers_personal_training) FROM stdin;
3acb6516-0e33-4c5e-85ca-93ae89384d94	7a7643d1-15c5-4750-8f21-dcec5179f82d	Manar Al Rayes	TaeKwonDo Instructor, International Referee	4.5	15	\N	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760586475557.jpg	2025-10-16 05:26:34.611505+00	2025-10-16 05:26:34.611505+00	\N	\N	\N	{taekwondo,judo}	{}	8138a6e4-aea3-47e1-91b3-1dfaf8632bdf	\N	f
5aba852c-2af9-4912-ae14-3dde451b26eb	fb19b81e-1874-4451-8193-9429d637efc8	Fahad Aayed Alanzi	TaeKwonDo Instructor	4.5	10	\N	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/instructor-fb19b81e-1874-4451-8193-9429d637efc8-1760564153268.jpg	2025-10-19 01:09:56.235784+00	2025-10-19 01:09:56.235784+00	\N	\N	\N	{taekwondo}	{}	63a62e9c-37b9-40d4-9da4-40550f7d1121	\N	f
31735e81-f023-4543-999a-c91a09f6add5	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	Sami Al Manea	TaeKwonDo Instructor	4.5	25	\N	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760528371681.jpg	2025-10-16 04:28:29.139461+00	2025-10-16 04:28:29.139461+00	\N	\N	\N	{taekwondo,fitness}	{}	805fa4e4-0f6a-420f-89be-c3adbbc5a2a8	\N	f
cd9a2bc6-121a-4fa1-b7f4-9b041242a8e6	7a7643d1-15c5-4750-8f21-dcec5179f82d	Ahmed	Men TaeKwonDo Instructor	4.5	8	\N	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760586524468.jpg	2025-10-16 04:39:04.309343+00	2025-10-16 04:39:04.309343+00	\N	\N	\N	{taekwondo}	{}	e5858643-24ad-468e-bb75-ae74eaa2a518	\N	f
592530b9-c014-4146-a635-accae64e5d5a	fb19b81e-1874-4451-8193-9429d637efc8	Hassan Ali Shalan	TaeKwonDo Instructor	4.5	20	\N	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760502805477.jpg	2025-10-16 05:56:48.141424+00	2025-10-16 05:56:48.141424+00	\N	\N	\N	{taekwondo}	{}	374f2fab-e687-408c-beb3-368faaff401a	\N	f
0f4b8a8b-4231-4ead-9753-c85ce320ddb6	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	Sulaiman	TaeKwonDo Instructor	4.5	8	\N	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/instructor-bbcc719f-7fd5-41b6-b2c0-3834a4e94018-1760759255222.jpg	2025-10-18 03:04:12.036919+00	2025-10-18 03:47:42.681936+00	\N	\N	\N	{taekwondo}	{}	783970b1-629f-4aad-a43d-5e9f01095ae3	\N	f
bf4b5471-c006-4392-9f5c-2a1dfe2686b6	7a7643d1-15c5-4750-8f21-dcec5179f82d	Ghaida	Ladies TaeKwonDo Instructor	4.5	10	\N	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760586179874.jpg	2025-10-16 04:37:38.234663+00	2025-10-16 04:37:38.234663+00	\N	\N	\N	{taekwondo}	{}	1ce1d09d-49fd-4b7d-80ab-c99b0a901040	\N	f
\.


--
-- Data for Name: club_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.club_members (id, club_id, user_id, name, avatar_url, rank, achievements, joined_date, created_at, updated_at, child_id, left_date, is_active, leave_reason, is_instructor, payment_screenshot_url) FROM stdin;
805fa4e4-0f6a-420f-89be-c3adbbc5a2a8	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	e54bd861-1c4e-4b4e-9fc6-ddfeac66ed19	Sami Al Manea	\N	Owner	0	2025-10-15	2025-10-15 12:04:23.537074+00	2025-10-16 04:28:27.713+00	\N	\N	t	\N	t	\N
1261b5ec-f8cb-4374-81a3-22bf06ed565c	fb19b81e-1874-4451-8193-9429d637efc8	3f9a5abf-a9c8-46de-ad7f-0466a8c1e054	Ghassan Mohamed Yusuf	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760503128271.jpg	Instructor	0	2025-10-15	2025-10-15 04:59:56.944768+00	2025-10-15 05:20:12.295+00	\N	2025-10-15	f	found better oppertunity	t	\N
1ce1d09d-49fd-4b7d-80ab-c99b0a901040	7a7643d1-15c5-4750-8f21-dcec5179f82d	e6918d3a-50dc-4855-8843-bf85b1cd8ae5	Ghaida	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760586179874.jpg	Instructor	0	2025-10-16	2025-10-16 03:54:25.359671+00	2025-10-16 04:37:36.774+00	\N	\N	t	\N	t	\N
e5858643-24ad-468e-bb75-ae74eaa2a518	7a7643d1-15c5-4750-8f21-dcec5179f82d	6012dbc2-411f-4c50-a828-43c1263618dd	Ahmed	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760586524468.jpg	Instructor	0	2025-10-16	2025-10-16 03:52:58.903659+00	2025-10-16 04:39:02.898+00	\N	\N	t	\N	t	\N
8138a6e4-aea3-47e1-91b3-1dfaf8632bdf	7a7643d1-15c5-4750-8f21-dcec5179f82d	7c3fe146-41ab-4506-9a8f-d646e686b00c	Manar Al Rayes	\N	Owner	0	2025-10-15	2025-10-15 21:47:02.654715+00	2025-10-16 05:26:33.401+00	\N	\N	t	\N	t	\N
374f2fab-e687-408c-beb3-368faaff401a	fb19b81e-1874-4451-8193-9429d637efc8	28bd1311-4b1c-4155-961b-0667b0d55c96	Hassan Ali Shalan	\N	Owner	0	2025-10-15	2025-10-15 04:04:14.890522+00	2025-10-16 05:56:46.902+00	\N	\N	t	\N	t	\N
35c98e1c-30e3-4fb1-8797-0736b32e0772	7a7643d1-15c5-4750-8f21-dcec5179f82d	\N	Ayoob Ghassan Mohamed	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760714470479.png	Member	0	2025-10-17	2025-10-17 20:55:45.613827+00	2025-10-17 20:55:45.613827+00	b58cb0ed-c095-4b58-9bc6-a40fce9f4001	\N	t	\N	f	\N
783970b1-629f-4aad-a43d-5e9f01095ae3	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	6efe5161-8bd0-4088-b2d2-beb995b6a0f1	Sulaiman	\N	Instructor	0	2025-10-18	2025-10-18 03:04:10.974561+00	2025-10-18 03:04:10.974561+00	\N	\N	t	\N	t	\N
63a62e9c-37b9-40d4-9da4-40550f7d1121	fb19b81e-1874-4451-8193-9429d637efc8	4092bc21-4832-467f-841a-2b3a9b969029	Fahad	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/instructor-fb19b81e-1874-4451-8193-9429d637efc8-1760564153268.jpg	Instructor	0	2025-10-15	2025-10-15 21:36:56.472585+00	2025-10-19 01:09:55.039+00	\N	\N	t	\N	t	\N
4b9a8e69-8bda-4de9-8d80-8bf80db0c93f	7a7643d1-15c5-4750-8f21-dcec5179f82d	\N	Mohamed Ghassan Mohammed	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/child-1760758196623.png	Beginner	0	2025-10-26	2025-10-26 07:04:06.46795+00	2025-10-26 07:04:06.46795+00	c9f30e02-887a-4f28-b93f-105bdcac6ea9	\N	t	\N	f	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/payment-7a7643d1-15c5-4750-8f21-dcec5179f82d-1761462239422.jpg
b9ce2527-33bf-4017-95a0-bf81bc152984	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	\N	Ayoob Ghassan Mohamed	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760714470479.png	Member	0	2025-10-26	2025-10-26 14:35:21.633506+00	2025-10-26 14:35:21.633506+00	b58cb0ed-c095-4b58-9bc6-a40fce9f4001	\N	t	\N	f	\N
a627d0ea-c684-4293-936c-16d5932e4541	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	\N	Mohamed Ghassan Mohammed	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/child-1760758196623.png	Member	0	2025-10-26	2025-10-26 14:35:21.633506+00	2025-10-26 14:35:21.633506+00	c9f30e02-887a-4f28-b93f-105bdcac6ea9	\N	t	\N	f	\N
1d26acbb-f15b-4d6d-aee3-a11211ad9c6d	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	\N	Zahra Ghassan Mohamed	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/child-1760758334390.jpg	Member	0	2025-10-26	2025-10-26 14:35:21.633506+00	2025-10-26 14:35:21.633506+00	cb4748a6-0523-484a-a3ee-7be6d2a9a395	\N	t	\N	f	\N
\.


--
-- Data for Name: club_packages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.club_packages (id, club_id, name, price, duration_months, is_popular, created_at, updated_at, popularity, activity_type, age_min, age_max, gender_restriction, picture_url, duration_type, session_count, discount_code, discount_percentage, start_date, end_date, booking_enabled, max_bookings, description) FROM stdin;
cd1b7b06-5cb1-4f32-a28c-1b461c7177cd	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	Kids + (S.M.W) Group B	35.00	1	f	2025-10-15 20:28:50.799465+00	2025-11-03 00:10:24.887072+00	50	single	7	10	mixed	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/1760759615273-1760759625905.jpg	duration	\N	\N	0	\N	\N	t	\N	\N
15ff2ba3-5455-423a-a813-2d4a3575c803	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	Kids + (S.T.T) Group B	35.00	1	f	2025-10-15 20:40:06.456039+00	2025-11-03 00:10:24.887072+00	0	single	7	10	mixed	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/1760759726882-1760759744953.jpg	duration	\N	\N	0	\N	\N	t	\N	\N
4eb0796f-8c81-49da-ad52-a6820915fc92	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	Ladies (S.T.T) Group A	35.00	1	f	2025-10-15 20:45:38.84089+00	2025-11-03 00:10:24.887072+00	0	single	11	\N	female	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/1760758625570-1760758648722.jpg	duration	\N	\N	0	\N	\N	t	\N	\N
6858ac77-8e42-4335-9304-8f65a4d02144	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	Ladies (S.T.T) Group B	35.00	1	f	2025-10-15 20:46:12.014316+00	2025-11-03 00:10:24.887072+00	0	single	\N	\N	female	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/1760758699586-1760758721755.jpg	duration	\N	\N	0	\N	\N	t	\N	\N
1e5d4692-6eea-47de-a351-8ef2b440875e	7a7643d1-15c5-4750-8f21-dcec5179f82d	Teenager +	30.00	1	f	2025-10-17 20:10:02.247821+00	2025-11-03 00:10:24.887072+00	0	single	9	12	mixed	\N	duration	\N	\N	0	\N	\N	t	\N	\N
ff88d577-fb97-4095-bf94-93b02e090013	fb19b81e-1874-4451-8193-9429d637efc8	Kids	30.00	1	f	2025-10-15 21:29:52.321336+00	2025-11-03 00:10:24.887072+00	0	single	4	6	mixed	\N	duration	\N	\N	0	\N	\N	t	\N	\N
83a29f3a-cac5-4404-8750-847a11495010	fb19b81e-1874-4451-8193-9429d637efc8	Kids+ Group B	30.00	1	f	2025-10-15 21:31:42.336497+00	2025-11-03 00:10:24.887072+00	0	single	7	12	mixed	\N	duration	\N	\N	0	\N	\N	t	\N	\N
acb684fd-2896-4910-8d70-d5cdce575be7	fb19b81e-1874-4451-8193-9429d637efc8	Kids+ Group A	30.00	1	f	2025-10-15 21:30:43.161335+00	2025-11-03 00:10:24.887072+00	0	single	7	12	mixed	\N	duration	\N	\N	0	\N	\N	t	\N	\N
af9af30b-c9fd-491b-8e95-35a1f13a88e0	fb19b81e-1874-4451-8193-9429d637efc8	Teenagers	30.00	1	f	2025-10-15 21:32:59.246056+00	2025-11-03 00:10:24.887072+00	0	single	9	\N	mixed	\N	duration	\N	\N	0	\N	\N	t	\N	\N
537d775e-a067-4683-8404-d68fcb57ebf9	7a7643d1-15c5-4750-8f21-dcec5179f82d	Kids	30.00	1	f	2025-10-17 19:47:06.01847+00	2025-11-03 00:10:24.887072+00	0	single	4	6	mixed	\N	duration	\N	\N	0	\N	\N	t	\N	\N
b2d65d14-110e-44eb-b1c7-41b3932531e1	7a7643d1-15c5-4750-8f21-dcec5179f82d	Kids+ CLASS B	30.00	1	f	2025-10-17 20:08:17.106604+00	2025-11-03 00:10:24.887072+00	100	single	7	12	mixed	\N	duration	\N	\N	0	\N	\N	t	\N	\N
56665c17-7819-4dc7-9c77-db50fe9325e9	7a7643d1-15c5-4750-8f21-dcec5179f82d	Kids+ CLASS A	30.00	1	f	2025-10-17 20:06:13.614653+00	2025-11-03 00:10:24.887072+00	0	single	7	12	mixed	\N	duration	\N	\N	0	\N	\N	t	\N	\N
cedf7781-6296-4958-86e3-051b1f90eacc	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	Kids (S.M.W) Group A	35.00	1	f	2025-10-15 20:19:58.563145+00	2025-11-03 00:10:24.887072+00	50	single	5	6	mixed	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/1760758878940-1760758898196.jpg	duration	\N	\N	0	\N	\N	t	\N	\N
70640995-dd65-4d9b-8938-6eee5e370667	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	Juniors & Fighters (S.M.W) Group A	35.00	1	f	2025-10-15 20:30:16.861667+00	2025-11-03 00:10:24.887072+00	0	single	7	14	mixed	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/1760758922444-1760758946883.jpg	duration	\N	\N	0	\N	\N	t	\N	\N
6cc31494-f8f3-41de-aa09-7ad8849868ab	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	Juniors (S.T.T) Group B	35.00	1	f	2025-10-15 20:42:50.09757+00	2025-11-03 00:10:24.887072+00	0	single	11	13	mixed	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/1760759003755-1760759026625.jpg	duration	\N	\N	0	\N	\N	t	\N	\N
86b3de2b-db80-4dcb-9399-444cf6901105	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	Kids (S.T.T) Group A	35.00	1	f	2025-10-15 20:39:08.758255+00	2025-11-03 00:10:24.887072+00	50	single	3	5	mixed	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/1760759086525-1760759104005.jpg	duration	\N	\N	0	\N	\N	t	\N	\N
27089697-a56b-4c29-8689-7a8882dd99e0	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	Men & Youth (S.M.W) Group A	35.00	1	f	2025-10-15 20:32:27.277455+00	2025-11-03 00:10:24.887072+00	0	single	14	\N	mixed	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/1760758793819-1760758822280.jpg	duration	\N	\N	0	\N	\N	t	\N	\N
\.


--
-- Data for Name: club_partners; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.club_partners (id, club_id, name, description, discount_text, logo_url, created_at, updated_at, category, terms, requirements, contact_info) FROM stdin;
\.


--
-- Data for Name: club_pictures; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.club_pictures (id, club_id, image_url, display_order, created_at, description) FROM stdin;
42a9255e-17bd-46b9-80ab-630a111dd3e7	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-bbcc719f-7fd5-41b6-b2c0-3834a4e94018-gallery-1760556288190.jpg	6	2025-10-15 19:24:50.122636+00	\N
c8119084-b055-4a02-b1a8-9228a344b90b	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-bbcc719f-7fd5-41b6-b2c0-3834a4e94018-gallery-1760556106860.jpg	2	2025-10-15 19:21:49.111834+00	\N
41f52c59-1b13-4367-ad7e-e17c6add13f8	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-bbcc719f-7fd5-41b6-b2c0-3834a4e94018-gallery-1760556154712.jpg	3	2025-10-15 19:22:36.603293+00	\N
cab78a71-be0a-4266-899e-3710aeaeda3e	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-bbcc719f-7fd5-41b6-b2c0-3834a4e94018-gallery-1760556254387.jpg	5	2025-10-15 19:24:16.601518+00	\N
\.


--
-- Data for Name: club_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.club_products (id, club_id, name, description, price, category, image_url, in_stock, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: club_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.club_reviews (id, club_id, user_id, reviewer_name, rating, comment, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: club_statistics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.club_statistics (id, club_id, total_workouts, active_members, calories_burned, average_session_minutes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: clubs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clubs (id, name, description, location, rating, members_count, classes_count, trainers_count, peak_hours, image_url, created_at, updated_at, welcoming_message, gps_latitude, gps_longitude, link_tree, logo_url, owner_name, owner_contact, owner_email, slogan, slogan_explanation, club_email, club_phone, currency, timezone, club_slug, opening_hours, bank_name, bank_account_name, bank_account_number, bank_iban, bank_swift_code, member_code_prefix, invoice_code_prefix, receipt_code_prefix, expense_code_prefix, specialist_code_prefix, favicon_url, club_phone_code, owner_contact_code, enrollment_fee, child_code_prefix, commercial_registration_number, vat_registration_number, vat_percentage, map_zoom, business_owner_id, country_iso) FROM stdin;
bbcc719f-7fd5-41b6-b2c0-3834a4e94018	EMPEROR TAEKWONDO ACADEMY	a happy welcoming socializing place built for achieving greatnes	Road 1238, Dar Kulayb, Northern Governorate, Bahrain	0.0	7	0	0	\N	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-bbcc719f-7fd5-41b6-b2c0-3834a4e94018-cover-1760759485991.jpg	2025-10-15 12:04:18.242307+00	2025-10-26 14:35:21.633506+00		26.09207319920245	50.512003898620605	[{"url": "https://www.instagram.com/emperor_eta/", "title": "Instagram"}, {"url": "https://www.tiktok.com/@emperor7612", "title": "TikTok"}, {"url": "https://www.snapchat.com/@emperorsameta", "title": "snapchat"}, {"url": "https://wa.me/97333950778", "title": "WhatsApp"}, {"url": "tel:0097333950778", "title": "Phone"}, {"url": "mailto:emperorsameta@gmail.com", "title": "Email"}]	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-bbcc719f-7fd5-41b6-b2c0-3834a4e94018-logo-1760529898182.png	Sami Al Manea	33950778	emperorsameta@gmail.com	walk the path and build your empire	\N	emperorsameta@gmail.com	33950778	BHD	Asia/Bahrain	eta	{}	\N	\N	\N	\N	\N	MEM	INV	REC	EXP	SPEC	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-bbcc719f-7fd5-41b6-b2c0-3834a4e94018-favicon-1760529903680.png	+973	+973	10	CHILD	\N	\N	10	16	e54bd861-1c4e-4b4e-9fc6-ddfeac66ed19	BH
d42a4d50-4998-43b4-999f-ebb3b9bca880	Yousif Clube	this is yousif club		0.0	0	0	0	\N	\N	2025-11-02 08:40:05.41632+00	2025-11-02 08:42:19.003021+00		\N	\N	[]	\N	yousiftest@ccn.com		yousiftest@ccn.com		\N			BHD	Asia/Bahrain	yc	[]	\N	\N	\N	\N	\N	MEM	INV	REC	EXP	SPEC	\N	+973		20	CHILD	\N	\N	10	13	621e3afd-2f52-4a86-a419-9d70be632530	BH
fb19b81e-1874-4451-8193-9429d637efc8	LEGEND TAEKWONDO ACADEMY	Whatever	Road 3820, الدراز, Northern Governorate, Bahrain	0.0	6	0	0	\N	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-fb19b81e-1874-4451-8193-9429d637efc8-cover-1760502366322.jpg	2025-10-15 04:04:10.09307+00	2025-11-02 10:22:59.466769+00		26.21591449932823	50.464249849319465	[]	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-fb19b81e-1874-4451-8193-9429d637efc8-logo-1760502306248.png	Hassan Ali Shalan	36722245	hasanshalan114@gmail.com		\N	hasanshalan114@gmail.com	36722245	BHD	Asia/Bahrain	lta	{}	\N	\N	\N	\N	\N	MEM	INV	REC	EXP	SPEC	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-fb19b81e-1874-4451-8193-9429d637efc8-favicon-1760502315742.png	+973	+973	7	CHILD	\N	\N	10	17	\N	BH
7a7643d1-15c5-4750-8f21-dcec5179f82d	PHOENIX TAEKWONDO ACADEMY		Road 1101, Manama, Capital Governorate, Bahrain	0.0	11	0	0	\N	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-7a7643d1-15c5-4750-8f21-dcec5179f82d-cover-1760726358161.jpg	2025-10-15 21:47:00.53319+00	2025-11-02 10:22:59.466769+00		26.1984241570691	50.564113855361946	[]	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-7a7643d1-15c5-4750-8f21-dcec5179f82d-logo-1760564920704.png	Manar Al Rayes	39824114	manar@gmail.com		\N	phoenix.tkd.bh@gmail.com	39824114	BHD	Asia/Bahrain	pta	{}	\N	\N	\N	\N	\N	MEM	INV	REC	EXP	SPEC	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-7a7643d1-15c5-4750-8f21-dcec5179f82d-favicon-1760564927189.png	+973	+973	7	CHILD	\N	\N	0	16	7c3fe146-41ab-4506-9a8f-d646e686b00c	BH
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversations (id, club_id, user_id, title, last_message_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: facility_operating_hours; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.facility_operating_hours (id, club_facility_id, day_of_week, start_time, end_time, created_at) FROM stdin;
35d28b95-95e3-4694-a82d-cc61eb5f7f58	095e0b27-d269-413f-a057-5c3b227643fd	Saturday	16:00:00	22:00:00	2025-10-15 18:31:12.430126+00
103660aa-733e-4172-a24f-ad750d506e32	095e0b27-d269-413f-a057-5c3b227643fd	Sunday	16:00:00	22:00:00	2025-10-15 18:31:12.430126+00
4829ff2a-831b-4362-a8b4-61b4f8d115be	095e0b27-d269-413f-a057-5c3b227643fd	Monday	16:00:00	22:00:00	2025-10-15 18:31:12.430126+00
70e58913-e216-4080-8cd4-dabd6f72fe14	095e0b27-d269-413f-a057-5c3b227643fd	Tuesday	16:00:00	22:00:00	2025-10-15 18:31:12.430126+00
a7a0a800-b9b3-4e14-9d46-a04820d5f319	095e0b27-d269-413f-a057-5c3b227643fd	Wednesday	16:00:00	22:00:00	2025-10-15 18:31:12.430126+00
f412df44-8bb0-4739-bc90-9751cd12fd3f	095e0b27-d269-413f-a057-5c3b227643fd	Thursday	16:00:00	22:00:00	2025-10-15 18:31:12.430126+00
128da3f7-c7f4-4d18-b7de-ee4bead3b5db	f367e4cd-d41e-49a7-ba0e-317337f34952	Saturday	16:30:00	19:30:00	2025-10-15 19:06:41.390703+00
5019d121-79fe-4a69-97f7-6103f9e9529a	f367e4cd-d41e-49a7-ba0e-317337f34952	Sunday	16:30:00	19:30:00	2025-10-15 19:06:41.390703+00
65fdbc33-c3f0-475f-8011-92b5375b1df4	f367e4cd-d41e-49a7-ba0e-317337f34952	Monday	16:30:00	19:30:00	2025-10-15 19:06:41.390703+00
0f3991da-a992-45d7-a3be-56803e675790	f367e4cd-d41e-49a7-ba0e-317337f34952	Tuesday	16:30:00	19:30:00	2025-10-15 19:06:41.390703+00
184e0bf3-c129-4870-b557-6e199b7b4e7b	f367e4cd-d41e-49a7-ba0e-317337f34952	Wednesday	16:30:00	19:30:00	2025-10-15 19:06:41.390703+00
62eb4df1-3de9-4b2e-bb9d-b7a67c881dce	f367e4cd-d41e-49a7-ba0e-317337f34952	Thursday	16:30:00	19:30:00	2025-10-15 19:06:41.390703+00
bc7d9afb-0246-4a10-93e9-463eee60a3ca	842d7a64-a4a8-43ae-8eef-7359a604960d	Saturday	16:30:00	19:30:00	2025-10-17 19:38:49.467837+00
d0ac9f31-edd1-4c6b-ba0d-cd008d490519	842d7a64-a4a8-43ae-8eef-7359a604960d	Sunday	16:30:00	19:30:00	2025-10-17 19:38:49.467837+00
4310218d-92d9-4a5c-8518-a1a6d3c92983	842d7a64-a4a8-43ae-8eef-7359a604960d	Monday	16:30:00	19:30:00	2025-10-17 19:38:49.467837+00
c0693019-a054-4555-8614-91332b2be955	842d7a64-a4a8-43ae-8eef-7359a604960d	Tuesday	16:30:00	19:30:00	2025-10-17 19:38:49.467837+00
a3e2472a-a68d-404a-9818-22195a488fae	842d7a64-a4a8-43ae-8eef-7359a604960d	Wednesday	16:30:00	19:30:00	2025-10-17 19:38:49.467837+00
8adde875-4167-49b5-bdd5-bfd2db9a593f	842d7a64-a4a8-43ae-8eef-7359a604960d	Thursday	16:30:00	19:30:00	2025-10-17 19:38:49.467837+00
\.


--
-- Data for Name: facility_pictures; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.facility_pictures (id, club_facility_id, image_url, display_order, created_at) FROM stdin;
26c2bfaf-7d4e-434f-b17d-fa61c5f58a40	095e0b27-d269-413f-a057-5c3b227643fd	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-bbcc719f-7fd5-41b6-b2c0-3834a4e94018-facility-new-picture-1760553038712-1760553063159.jpg	0	2025-10-15 18:31:12.631169+00
baa48a00-a781-4f04-9316-af8a15165835	f367e4cd-d41e-49a7-ba0e-317337f34952	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/club-fb19b81e-1874-4451-8193-9429d637efc8-facility-new-picture-1760554986704-1760555005424.jpg	0	2025-10-15 19:06:41.59404+00
\.


--
-- Data for Name: facility_rentable_times; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.facility_rentable_times (id, club_facility_id, day_of_week, start_time, end_time, created_at) FROM stdin;
\.


--
-- Data for Name: instructor_certifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.instructor_certifications (id, instructor_id, certificate_name, certificate_image_url, awarded_date, issuing_organization, description, certificate_number, expiry_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: instructor_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.instructor_reviews (id, instructor_id, member_id, rating, comment, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: member_acquired_skills; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.member_acquired_skills (id, membership_history_id, skill_name, skill_category, acquired_from_activity_id, acquired_date, created_at) FROM stdin;
\.


--
-- Data for Name: membership_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.membership_history (id, user_id, child_id, club_id, member_name, joined_date, left_date, duration_days, leave_reason, created_at) FROM stdin;
4202cf07-f8b6-4c58-b4d5-9f7528e12b29	3f9a5abf-a9c8-46de-ad7f-0466a8c1e054	\N	fb19b81e-1874-4451-8193-9429d637efc8	Ghassan Mohamed Yusuf	2025-10-15	2025-10-15	0	Instructor position ended	2025-10-15 05:00:31.328171+00
09a140e4-44b5-4277-b3ee-686efaceeb56	3f9a5abf-a9c8-46de-ad7f-0466a8c1e054	\N	fb19b81e-1874-4451-8193-9429d637efc8	Ghassan Mohamed Yusuf	2025-10-15	2025-10-15	0	found better oppertunity	2025-10-15 05:20:12.09636+00
\.


--
-- Data for Name: membership_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.membership_requests (id, user_id, club_id, status, requested_at, reviewed_at, reviewed_by, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.messages (id, conversation_id, sender_id, sender_type, content, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, club_id, type, title, message, is_read, action_url, created_at, read_at) FROM stdin;
\.


--
-- Data for Name: package_activities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.package_activities (id, package_id, class_id, created_at, activity_id, instructor_id) FROM stdin;
ff5ab9d2-766f-45bd-a4fa-cd7778ccbce1	6858ac77-8e42-4335-9304-8f65a4d02144	\N	2025-10-18 03:38:49.067045+00	d9bb5f9d-1f5b-4665-a330-0e9ff5455842	31735e81-f023-4543-999a-c91a09f6add5
79b08695-c037-4bc9-a345-148a57539d75	cedf7781-6296-4958-86e3-051b1f90eacc	\N	2025-10-18 03:41:45.14433+00	2d72f34f-27ad-49af-a9e7-9e5fac8c5cce	0f4b8a8b-4231-4ead-9753-c85ce320ddb6
5996ae1c-9d8b-4356-8647-dd75161d713f	6cc31494-f8f3-41de-aa09-7ad8849868ab	\N	2025-10-18 03:43:53.248947+00	56204342-7612-490a-ab90-870e2175d5f3	0f4b8a8b-4231-4ead-9753-c85ce320ddb6
36cf9fad-7cc4-44f3-958f-d08b26813156	cd1b7b06-5cb1-4f32-a28c-1b461c7177cd	\N	2025-10-18 03:53:52.873014+00	0576d84c-ea0e-4082-8a52-112a86d1b7fe	0f4b8a8b-4231-4ead-9753-c85ce320ddb6
6bf7d7c6-84cb-45bf-a767-5315e79c65ee	537d775e-a067-4683-8404-d68fcb57ebf9	\N	2025-10-18 11:55:25.43246+00	7c86302d-4b0d-46ad-a6a0-3acd45a4d025	3acb6516-0e33-4c5e-85ca-93ae89384d94
49fc81ab-e495-4e03-ba0c-dccef6211108	b2d65d14-110e-44eb-b1c7-41b3932531e1	\N	2025-10-18 11:56:09.293285+00	16512cae-942a-427d-9d34-09f618141183	3acb6516-0e33-4c5e-85ca-93ae89384d94
46bd5a79-cf1e-4498-a5e8-6cc8c9e6baf8	4eb0796f-8c81-49da-ad52-a6820915fc92	\N	2025-10-18 03:37:37.988628+00	35c36113-7081-4127-ad92-44a9378fc94a	31735e81-f023-4543-999a-c91a09f6add5
f1f9bf5b-6419-46cf-9961-f01d6353a1fd	27089697-a56b-4c29-8689-7a8882dd99e0	\N	2025-10-18 03:40:33.261333+00	d9bb5f9d-1f5b-4665-a330-0e9ff5455842	31735e81-f023-4543-999a-c91a09f6add5
c8ed802c-76ac-4e09-a328-8327b07f2da8	70640995-dd65-4d9b-8938-6eee5e370667	\N	2025-10-18 03:42:34.322713+00	e30baffd-ed4d-4c96-887d-d87473c7c0a5	31735e81-f023-4543-999a-c91a09f6add5
abd6923b-c973-48c5-a724-ea229cd366eb	86b3de2b-db80-4dcb-9399-444cf6901105	\N	2025-10-18 03:45:10.404929+00	335a50f9-3760-476d-82bb-416dd008ae54	0f4b8a8b-4231-4ead-9753-c85ce320ddb6
4a833122-33de-40fc-ba3a-80551dc39a1b	15ff2ba3-5455-423a-a813-2d4a3575c803	\N	2025-10-18 03:55:51.581488+00	c867435b-24c5-4529-9bc2-8fa9928ac1bb	0f4b8a8b-4231-4ead-9753-c85ce320ddb6
94b4b833-86c0-4892-a615-0316849a601f	56665c17-7819-4dc7-9c77-db50fe9325e9	\N	2025-10-18 11:55:49.821541+00	b9eccf70-cc83-4124-9468-20d7646443c9	3acb6516-0e33-4c5e-85ca-93ae89384d94
1496678b-0466-4de3-b2b5-defa8fc78a4a	1e5d4692-6eea-47de-a351-8ef2b440875e	\N	2025-10-18 11:56:33.81907+00	4541b920-6b36-4459-b7cb-c3f714e1d3ec	3acb6516-0e33-4c5e-85ca-93ae89384d94
\.


--
-- Data for Name: package_enrollments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.package_enrollments (id, package_id, member_id, enrolled_at, is_active, created_at, updated_at, package_price_version_id, enrollment_transaction_id, package_transaction_id) FROM stdin;
6edd3ff4-60d6-4b18-969f-4e6a841d2604	b2d65d14-110e-44eb-b1c7-41b3932531e1	4b9a8e69-8bda-4de9-8d80-8bf80db0c93f	2025-10-26 07:04:06.711572+00	t	2025-10-26 07:04:06.711572+00	2025-10-26 07:04:06.711572+00	\N	\N	\N
dad735bd-f50f-440d-9dda-f7b800d2a554	cedf7781-6296-4958-86e3-051b1f90eacc	b9ce2527-33bf-4017-95a0-bf81bc152984	2025-11-02 11:35:49.682776+00	t	2025-11-02 11:35:49.682776+00	2025-11-02 11:35:49.682776+00	\N	\N	\N
026d66c5-abb7-4f56-9a89-78c0ef0f4caa	cd1b7b06-5cb1-4f32-a28c-1b461c7177cd	a627d0ea-c684-4293-936c-16d5932e4541	2025-11-02 11:35:49.894307+00	t	2025-11-02 11:35:49.894307+00	2025-11-02 11:35:49.894307+00	\N	\N	\N
89acdbf9-2585-4d84-a285-d2342091bb1b	86b3de2b-db80-4dcb-9399-444cf6901105	b9ce2527-33bf-4017-95a0-bf81bc152984	2025-11-02 11:43:53.677456+00	t	2025-11-02 11:43:53.677456+00	2025-11-02 11:43:53.677456+00	\N	\N	\N
\.


--
-- Data for Name: package_price_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.package_price_history (id, package_id, price, vat_percentage, valid_from, valid_until, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profiles (id, user_id, name, avatar_url, phone, country_code, date_of_birth, gender, nationality, address, created_at, updated_at, blood_type, email) FROM stdin;
acdf0295-99f5-4609-93d1-4b8b51a5883b	6efe5161-8bd0-4088-b2d2-beb995b6a0f1	Sulaiman Rashid Shabib	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/instructor-bbcc719f-7fd5-41b6-b2c0-3834a4e94018-1760759255222.jpg	37700894	+973	2007-08-01	male	BH	\N	2025-10-18 03:04:06.229543+00	2025-10-18 05:53:06.529796+00	dont_know	sshbyb411@gmil.com
3adc3b13-6232-4713-845e-42b758664587	7c3fe146-41ab-4506-9a8f-d646e686b00c	Manar Al Rayes	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760586475557.jpg	39824114	+973	1989-05-10	female	BH	\N	2025-10-15 21:43:41.78652+00	2025-10-18 05:55:20.131817+00	dont_know	phoenix.tkd.bh@gmail.com
1b5e9703-e28a-46f2-91ed-b20fcecc6ff4	6012dbc2-411f-4c50-a828-43c1263618dd	Ahmed	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760586524468.jpg	33791210	+973	1996-03-03	male	BH	\N	2025-10-16 03:50:19.348804+00	2025-10-16 03:50:19.708108+00	dont_know	ahmed@gmaill.com
dc9d8e95-1c5b-4167-8c86-81156099039b	3f9a5abf-a9c8-46de-ad7f-0466a8c1e054	Ghassan Mohamed Yusuf	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760503128271.jpg	33165444	+973	1983-01-30	male	BH	\N	2025-10-15 04:37:31.602804+00	2025-10-15 04:40:57.774966+00	dont_know	platformtakeone@gmail.com
59df86d5-0040-401e-aef7-8eecc10bc58a	28bd1311-4b1c-4155-961b-0667b0d55c96	Hassan Ali Shalan	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760502805477.jpg	36722245	+973	1987-12-22	male	BH	\N	2025-10-15 04:04:14.077775+00	2025-10-15 09:41:51.798+00	dont_know	hasanshalan114@gmail.com
8146285b-15af-4932-a56d-d85055c10276	e54bd861-1c4e-4b4e-9fc6-ddfeac66ed19	Sami Al Manea	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760528371681.jpg	33950778	+973	1976-12-10	male	BH	\N	2025-10-15 11:36:10.498537+00	2025-10-15 11:41:38.848696+00	dont_know	emperorsameta@gmail.com
90c950d6-5097-48c4-b761-d89c940dd4f3	e6918d3a-50dc-4855-8843-bf85b1cd8ae5	Ghaida	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/profile-1760586179874.jpg	38357672	+973	1997-06-02	female	BH	\N	2025-10-16 03:46:47.281247+00	2025-10-16 03:46:47.71166+00	dont_know	ghaidaa@gmail.com
44380416-6ad6-43a1-bd94-dbe9bd11b678	4092bc21-4832-467f-841a-2b3a9b969029	Fahad Aayed Alanzi	https://zcwfreuywtlrrgevhtmo.supabase.co/storage/v1/object/public/avatars/3f9a5abf-a9c8-46de-ad7f-0466a8c1e054/instructor-fb19b81e-1874-4451-8193-9429d637efc8-1760564153268.jpg	36424438	+973	1998-03-15	male	BH	\N	2025-10-15 21:36:51.993718+00	2025-10-18 11:50:53.514292+00	dont_know	theemperorfahad@gmail.com
faa5f848-7992-4e86-bad2-4a6cead12ca5	621e3afd-2f52-4a86-a419-9d70be632530	yousiftest@ccn.com	\N		+1	2000-01-01	male	US	\N	2025-10-29 12:16:48.876109+00	2025-10-29 12:16:48.876109+00	\N	yousiftest@ccn.com
cc4ab70e-5440-4101-b928-e0701a0357cd	2f7aaf17-cd15-43a5-b296-3f1ee3d0ab9f	TestYousif	\N	37123456	+973	1992-10-16	male	Bahrain	\N	2025-10-30 07:28:54.475479+00	2025-10-30 07:28:54.662716+00	\N	testYousif@cnn.com
45d5b6b3-1e85-4546-a46d-79679434a328	97423a6f-8c7f-4009-bc9d-56d4382f41c7	member1	\N	37321789	+973	1994-11-10	male	Bahrain	\N	2025-11-02 09:43:31.442621+00	2025-11-02 09:43:31.840427+00	\N	member1@ccn.com
\.


--
-- Data for Name: transaction_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transaction_history (id, transaction_id, changed_by, changed_at, change_type, previous_values, new_values, notes) FROM stdin;
\.


--
-- Data for Name: transaction_ledger; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transaction_ledger (id, club_id, transaction_type, category, description, amount, vat_amount, vat_percentage_applied, total_amount, payment_method, payment_screenshot_url, receipt_number, member_id, package_price_version_id, enrollment_id, reference_id, transaction_date, created_at, created_by, notes, payment_status, payment_proof_url, approved_by, approved_at, rejection_reason, is_refund, refund_amount, refunded_transaction_id, refund_proof_url, updated_by, updated_at, version, change_history, member_name, member_email, member_phone) FROM stdin;
e9c23123-6025-45d0-9f40-ad3bd0154119	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	package_fee	\N	Package: Kids (S.M.W) Group A - Ayoob Ghassan Mohamed	35.00	3.50	10.00	38.50	pending	\N	REC-00001	b9ce2527-33bf-4017-95a0-bf81bc152984	\N	dad735bd-f50f-440d-9dda-f7b800d2a554	\N	2025-11-02	2025-11-02 11:35:49.872461+00	\N	1-month package for Ayoob Ghassan Mohamed	pending	\N	\N	\N	\N	f	\N	\N	\N	\N	2025-11-02 11:35:49.872461+00	1	[]	Ayoob Ghassan Mohamed		+1
bd624030-adc2-4f0f-8541-8fdd7af9c5c8	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	package_fee	\N	Package: Kids + (S.M.W) Group B - Mohamed Ghassan Mohammed	35.00	3.50	10.00	38.50	pending	\N	REC-00002	a627d0ea-c684-4293-936c-16d5932e4541	\N	026d66c5-abb7-4f56-9a89-78c0ef0f4caa	\N	2025-11-02	2025-11-02 11:35:49.929131+00	\N	1-month package for Mohamed Ghassan Mohammed	pending	\N	\N	\N	\N	f	\N	\N	\N	\N	2025-11-02 11:35:49.929131+00	1	[]	Mohamed Ghassan Mohammed		+1
3d1a2e81-41b1-431a-94ea-de5c520d791c	bbcc719f-7fd5-41b6-b2c0-3834a4e94018	package_fee	\N	Package: Kids (S.T.T) Group A - Ayoob Ghassan Mohamed	35.00	3.50	10.00	38.50	pending	\N	REC-00003	b9ce2527-33bf-4017-95a0-bf81bc152984	\N	89acdbf9-2585-4d84-a285-d2342091bb1b	\N	2025-11-02	2025-11-02 11:43:53.937557+00	\N	1-month package for Ayoob Ghassan Mohamed	pending	\N	\N	\N	\N	f	\N	\N	\N	\N	2025-11-02 11:43:53.937557+00	1	[]	Ayoob Ghassan Mohamed		+1
0622d415-8507-40ff-b540-2ae61c2430a3	d42a4d50-4998-43b4-999f-ebb3b9bca880	product_sale	\N	Manual Income: pack	300.00	30.00	10.00	330.00	cash	\N	REC-00001	\N	\N	\N	\N	2025-11-03	2025-11-03 10:55:28.134336+00	\N		paid	\N	\N	\N	\N	f	\N	\N	\N	\N	2025-11-03 10:55:28.134336+00	1	[]	\N	\N	\N
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (id, user_id, role, created_at) FROM stdin;
a9e4c6de-6b3a-49c4-a7f4-fef5ff1de594	3f9a5abf-a9c8-46de-ad7f-0466a8c1e054	super_admin	2025-10-15 03:46:17.38537+00
5aafe966-c8ff-4846-b81f-495d757d65a1	28bd1311-4b1c-4155-961b-0667b0d55c96	admin	2025-10-15 04:04:14.350024+00
d564cc72-0c9c-4247-a27f-e3bc77b54688	e54bd861-1c4e-4b4e-9fc6-ddfeac66ed19	admin	2025-10-15 12:04:22.968883+00
c5e4fbcb-3d41-42af-8f5f-8a82847d556d	7c3fe146-41ab-4506-9a8f-d646e686b00c	admin	2025-10-15 21:47:02.111479+00
e168736f-a21a-4d88-b943-0d0a191f8d70	7c3fe146-41ab-4506-9a8f-d646e686b00c	business_owner	2025-10-17 19:31:10.986513+00
7d8413cc-c991-44c3-ae09-76409af8ce2e	e54bd861-1c4e-4b4e-9fc6-ddfeac66ed19	business_owner	2025-10-18 03:51:35.4629+00
dc655b7d-d4ea-447d-a171-cf0b31ab33b1	621e3afd-2f52-4a86-a419-9d70be632530	business_owner	2025-11-02 08:27:34.159023+00
36b172de-cabd-4621-9cee-3cbf6855e3bb	97423a6f-8c7f-4009-bc9d-56d4382f41c7	user	2025-11-02 09:43:31.924619+00
8da43885-cf72-450c-b550-d5184427d9a2	621e3afd-2f52-4a86-a419-9d70be632530	admin	2025-11-03 10:36:11.477162+00
\.


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: activity_schedules activity_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_schedules
    ADD CONSTRAINT activity_schedules_pkey PRIMARY KEY (id);


--
-- Name: activity_skills activity_skills_activity_id_skill_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_skills
    ADD CONSTRAINT activity_skills_activity_id_skill_name_key UNIQUE (activity_id, skill_name);


--
-- Name: activity_skills activity_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_skills
    ADD CONSTRAINT activity_skills_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: children children_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.children
    ADD CONSTRAINT children_pkey PRIMARY KEY (id);


--
-- Name: club_amenities club_amenities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_amenities
    ADD CONSTRAINT club_amenities_pkey PRIMARY KEY (id);


--
-- Name: club_classes club_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_classes
    ADD CONSTRAINT club_classes_pkey PRIMARY KEY (id);


--
-- Name: club_community_posts club_community_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_community_posts
    ADD CONSTRAINT club_community_posts_pkey PRIMARY KEY (id);


--
-- Name: club_instructors club_instructors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_instructors
    ADD CONSTRAINT club_instructors_pkey PRIMARY KEY (id);


--
-- Name: club_members club_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_pkey PRIMARY KEY (id);


--
-- Name: club_packages club_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_packages
    ADD CONSTRAINT club_packages_pkey PRIMARY KEY (id);


--
-- Name: club_partners club_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_partners
    ADD CONSTRAINT club_partners_pkey PRIMARY KEY (id);


--
-- Name: club_pictures club_pictures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_pictures
    ADD CONSTRAINT club_pictures_pkey PRIMARY KEY (id);


--
-- Name: club_products club_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_products
    ADD CONSTRAINT club_products_pkey PRIMARY KEY (id);


--
-- Name: club_reviews club_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_reviews
    ADD CONSTRAINT club_reviews_pkey PRIMARY KEY (id);


--
-- Name: club_statistics club_statistics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_statistics
    ADD CONSTRAINT club_statistics_pkey PRIMARY KEY (id);


--
-- Name: clubs clubs_club_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_club_slug_key UNIQUE (club_slug);


--
-- Name: clubs clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: club_facilities facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_facilities
    ADD CONSTRAINT facilities_pkey PRIMARY KEY (id);


--
-- Name: facility_operating_hours facility_operating_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facility_operating_hours
    ADD CONSTRAINT facility_operating_hours_pkey PRIMARY KEY (id);


--
-- Name: facility_pictures facility_pictures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facility_pictures
    ADD CONSTRAINT facility_pictures_pkey PRIMARY KEY (id);


--
-- Name: facility_rentable_times facility_rentable_times_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facility_rentable_times
    ADD CONSTRAINT facility_rentable_times_pkey PRIMARY KEY (id);


--
-- Name: instructor_certifications instructor_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructor_certifications
    ADD CONSTRAINT instructor_certifications_pkey PRIMARY KEY (id);


--
-- Name: instructor_reviews instructor_reviews_instructor_id_member_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructor_reviews
    ADD CONSTRAINT instructor_reviews_instructor_id_member_id_key UNIQUE (instructor_id, member_id);


--
-- Name: instructor_reviews instructor_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructor_reviews
    ADD CONSTRAINT instructor_reviews_pkey PRIMARY KEY (id);


--
-- Name: member_acquired_skills member_acquired_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_acquired_skills
    ADD CONSTRAINT member_acquired_skills_pkey PRIMARY KEY (id);


--
-- Name: membership_history membership_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_history
    ADD CONSTRAINT membership_history_pkey PRIMARY KEY (id);


--
-- Name: membership_requests membership_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_requests
    ADD CONSTRAINT membership_requests_pkey PRIMARY KEY (id);


--
-- Name: membership_requests membership_requests_user_id_club_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_requests
    ADD CONSTRAINT membership_requests_user_id_club_id_key UNIQUE (user_id, club_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: package_activities package_activities_package_id_class_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_activities
    ADD CONSTRAINT package_activities_package_id_class_id_key UNIQUE (package_id, class_id);


--
-- Name: package_activities package_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_activities
    ADD CONSTRAINT package_activities_pkey PRIMARY KEY (id);


--
-- Name: package_enrollments package_enrollments_package_id_member_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_enrollments
    ADD CONSTRAINT package_enrollments_package_id_member_id_key UNIQUE (package_id, member_id);


--
-- Name: package_enrollments package_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_enrollments
    ADD CONSTRAINT package_enrollments_pkey PRIMARY KEY (id);


--
-- Name: package_price_history package_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_price_history
    ADD CONSTRAINT package_price_history_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: transaction_history transaction_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_history
    ADD CONSTRAINT transaction_history_pkey PRIMARY KEY (id);


--
-- Name: transaction_ledger transaction_ledger_club_receipt_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_ledger
    ADD CONSTRAINT transaction_ledger_club_receipt_key UNIQUE (club_id, receipt_number);


--
-- Name: transaction_ledger transaction_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_ledger
    ADD CONSTRAINT transaction_ledger_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_activities_club_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activities_club_id ON public.activities USING btree (club_id);


--
-- Name: idx_activities_facility_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activities_facility_id ON public.activities USING btree (club_facility_id);


--
-- Name: idx_activity_schedules_activity_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_schedules_activity_id ON public.activity_schedules USING btree (activity_id);


--
-- Name: idx_club_instructors_member_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_club_instructors_member_id ON public.club_instructors USING btree (member_id);


--
-- Name: idx_club_members_is_instructor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_club_members_is_instructor ON public.club_members USING btree (club_id, is_instructor) WHERE (is_instructor = true);


--
-- Name: idx_clubs_business_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clubs_business_owner_id ON public.clubs USING btree (business_owner_id);


--
-- Name: idx_clubs_country_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clubs_country_slug ON public.clubs USING btree (country_iso, club_slug);


--
-- Name: idx_clubs_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clubs_slug ON public.clubs USING btree (club_slug);


--
-- Name: idx_conversations_club; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_club ON public.conversations USING btree (club_id, last_message_at DESC);


--
-- Name: idx_conversations_club_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_conversations_club_user ON public.conversations USING btree (club_id, user_id);


--
-- Name: idx_conversations_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_user ON public.conversations USING btree (user_id, last_message_at DESC);


--
-- Name: idx_facilities_club_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_facilities_club_id ON public.club_facilities USING btree (club_id);


--
-- Name: idx_facility_pictures_facility_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_facility_pictures_facility_id ON public.facility_pictures USING btree (club_facility_id);


--
-- Name: idx_facility_rentable_times_facility_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_facility_rentable_times_facility_id ON public.facility_rentable_times USING btree (club_facility_id);


--
-- Name: idx_instructor_certifications_instructor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_instructor_certifications_instructor_id ON public.instructor_certifications USING btree (instructor_id);


--
-- Name: idx_member_acquired_skills_history_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_member_acquired_skills_history_id ON public.member_acquired_skills USING btree (membership_history_id);


--
-- Name: idx_membership_history_club_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_membership_history_club_id ON public.membership_history USING btree (club_id);


--
-- Name: idx_membership_history_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_membership_history_user_id ON public.membership_history USING btree (user_id);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_sender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_id, created_at DESC);


--
-- Name: idx_notifications_club; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_club ON public.notifications USING btree (club_id, created_at DESC);


--
-- Name: idx_notifications_user_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_read ON public.notifications USING btree (user_id, is_read, created_at DESC);


--
-- Name: idx_package_activities_activity_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_activities_activity_id ON public.package_activities USING btree (activity_id);


--
-- Name: idx_package_activities_instructor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_activities_instructor_id ON public.package_activities USING btree (instructor_id);


--
-- Name: idx_package_enrollments_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_enrollments_active ON public.package_enrollments USING btree (is_active);


--
-- Name: idx_package_enrollments_member_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_enrollments_member_id ON public.package_enrollments USING btree (member_id);


--
-- Name: idx_package_enrollments_package_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_enrollments_package_id ON public.package_enrollments USING btree (package_id);


--
-- Name: idx_package_enrollments_price_version; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_enrollments_price_version ON public.package_enrollments USING btree (package_price_version_id);


--
-- Name: idx_package_price_history_package_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_price_history_package_id ON public.package_price_history USING btree (package_id);


--
-- Name: idx_package_price_history_valid_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_price_history_valid_dates ON public.package_price_history USING btree (package_id, valid_from, valid_until);


--
-- Name: idx_profiles_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_phone ON public.profiles USING btree (country_code, phone);


--
-- Name: idx_transaction_ledger_approved_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transaction_ledger_approved_at ON public.transaction_ledger USING btree (approved_at);


--
-- Name: idx_transaction_ledger_club_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transaction_ledger_club_id ON public.transaction_ledger USING btree (club_id);


--
-- Name: idx_transaction_ledger_club_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transaction_ledger_club_status ON public.transaction_ledger USING btree (club_id, payment_status);


--
-- Name: idx_transaction_ledger_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transaction_ledger_date ON public.transaction_ledger USING btree (transaction_date);


--
-- Name: idx_transaction_ledger_member_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transaction_ledger_member_id ON public.transaction_ledger USING btree (member_id);


--
-- Name: idx_transaction_ledger_payment_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transaction_ledger_payment_status ON public.transaction_ledger USING btree (payment_status);


--
-- Name: idx_transaction_ledger_receipt; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transaction_ledger_receipt ON public.transaction_ledger USING btree (receipt_number);


--
-- Name: idx_transaction_ledger_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transaction_ledger_type ON public.transaction_ledger USING btree (transaction_type);


--
-- Name: profiles_phone_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX profiles_phone_unique ON public.profiles USING btree (phone) WHERE ((phone IS NOT NULL) AND (phone <> ''::text));


--
-- Name: unique_adult_member_per_club_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_adult_member_per_club_idx ON public.club_members USING btree (club_id, user_id) WHERE ((user_id IS NOT NULL) AND (child_id IS NULL));


--
-- Name: unique_child_member_per_club_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_child_member_per_club_idx ON public.club_members USING btree (club_id, child_id) WHERE ((child_id IS NOT NULL) AND (user_id IS NULL));


--
-- Name: unique_package_activity_instructor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_package_activity_instructor ON public.package_activities USING btree (package_id, activity_id, COALESCE(instructor_id, '00000000-0000-0000-0000-000000000000'::uuid));


--
-- Name: club_members trigger_decrement_club_members_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_decrement_club_members_count AFTER DELETE ON public.club_members FOR EACH ROW EXECUTE FUNCTION public.decrement_club_members_count();


--
-- Name: club_members trigger_increment_club_members_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_increment_club_members_count AFTER INSERT ON public.club_members FOR EACH ROW EXECUTE FUNCTION public.increment_club_members_count();


--
-- Name: club_members trigger_update_club_members_count_on_status_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_club_members_count_on_status_change AFTER UPDATE OF is_active ON public.club_members FOR EACH ROW WHEN ((old.is_active IS DISTINCT FROM new.is_active)) EXECUTE FUNCTION public.update_club_members_count_on_status_change();


--
-- Name: activities update_activities_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bank_accounts update_bank_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: children update_children_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_children_updated_at BEFORE UPDATE ON public.children FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: club_amenities update_club_amenities_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_club_amenities_updated_at BEFORE UPDATE ON public.club_amenities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: club_classes update_club_classes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_club_classes_updated_at BEFORE UPDATE ON public.club_classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: club_instructors update_club_instructors_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_club_instructors_updated_at BEFORE UPDATE ON public.club_instructors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: club_packages update_club_packages_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_club_packages_updated_at BEFORE UPDATE ON public.club_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: club_partners update_club_partners_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_club_partners_updated_at BEFORE UPDATE ON public.club_partners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: club_products update_club_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_club_products_updated_at BEFORE UPDATE ON public.club_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: club_reviews update_club_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_club_reviews_updated_at BEFORE UPDATE ON public.club_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clubs update_clubs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_clubs_updated_at BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: messages update_conversation_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_conversation_timestamp AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();


--
-- Name: club_facilities update_facilities_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON public.club_facilities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: instructor_certifications update_instructor_certifications_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_instructor_certifications_updated_at BEFORE UPDATE ON public.instructor_certifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: instructor_reviews update_instructor_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_instructor_reviews_updated_at BEFORE UPDATE ON public.instructor_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: membership_requests update_membership_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_membership_requests_updated_at BEFORE UPDATE ON public.membership_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: package_enrollments update_popularity_on_enrollment_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_popularity_on_enrollment_change AFTER INSERT OR DELETE OR UPDATE ON public.package_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_package_popularity();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: transaction_ledger update_transaction_ledger_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_transaction_ledger_updated_at BEFORE UPDATE ON public.transaction_ledger FOR EACH ROW EXECUTE FUNCTION public.update_transaction_updated_at();


--
-- Name: activities activities_club_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_club_facility_id_fkey FOREIGN KEY (club_facility_id) REFERENCES public.club_facilities(id) ON DELETE CASCADE;


--
-- Name: activities activities_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: activities activities_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_facility_id_fkey FOREIGN KEY (club_facility_id) REFERENCES public.club_facilities(id) ON DELETE CASCADE;


--
-- Name: activity_schedules activity_schedules_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_schedules
    ADD CONSTRAINT activity_schedules_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: activity_skills activity_skills_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_skills
    ADD CONSTRAINT activity_skills_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: bank_accounts bank_accounts_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: children children_parent_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.children
    ADD CONSTRAINT children_parent_user_id_fkey FOREIGN KEY (parent_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: club_amenities club_amenities_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_amenities
    ADD CONSTRAINT club_amenities_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_classes club_classes_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_classes
    ADD CONSTRAINT club_classes_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_classes club_classes_instructor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_classes
    ADD CONSTRAINT club_classes_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.club_instructors(id) ON DELETE SET NULL;


--
-- Name: club_community_posts club_community_posts_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_community_posts
    ADD CONSTRAINT club_community_posts_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_facilities club_facilities_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_facilities
    ADD CONSTRAINT club_facilities_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_instructors club_instructors_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_instructors
    ADD CONSTRAINT club_instructors_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_instructors club_instructors_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_instructors
    ADD CONSTRAINT club_instructors_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.club_members(id) ON DELETE CASCADE;


--
-- Name: club_members club_members_child_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.children(id) ON DELETE CASCADE;


--
-- Name: club_members club_members_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_packages club_packages_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_packages
    ADD CONSTRAINT club_packages_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_partners club_partners_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_partners
    ADD CONSTRAINT club_partners_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_pictures club_pictures_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_pictures
    ADD CONSTRAINT club_pictures_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_products club_products_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_products
    ADD CONSTRAINT club_products_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_reviews club_reviews_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_reviews
    ADD CONSTRAINT club_reviews_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_reviews club_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_reviews
    ADD CONSTRAINT club_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: club_statistics club_statistics_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_statistics
    ADD CONSTRAINT club_statistics_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: clubs clubs_business_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_business_owner_id_fkey FOREIGN KEY (business_owner_id) REFERENCES auth.users(id);


--
-- Name: conversations conversations_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_facilities facilities_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.club_facilities
    ADD CONSTRAINT facilities_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: facility_operating_hours facility_operating_hours_club_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facility_operating_hours
    ADD CONSTRAINT facility_operating_hours_club_facility_id_fkey FOREIGN KEY (club_facility_id) REFERENCES public.club_facilities(id) ON DELETE CASCADE;


--
-- Name: facility_pictures facility_pictures_club_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facility_pictures
    ADD CONSTRAINT facility_pictures_club_facility_id_fkey FOREIGN KEY (club_facility_id) REFERENCES public.club_facilities(id) ON DELETE CASCADE;


--
-- Name: facility_pictures facility_pictures_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facility_pictures
    ADD CONSTRAINT facility_pictures_facility_id_fkey FOREIGN KEY (club_facility_id) REFERENCES public.club_facilities(id) ON DELETE CASCADE;


--
-- Name: facility_rentable_times facility_rentable_times_club_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facility_rentable_times
    ADD CONSTRAINT facility_rentable_times_club_facility_id_fkey FOREIGN KEY (club_facility_id) REFERENCES public.club_facilities(id) ON DELETE CASCADE;


--
-- Name: facility_rentable_times facility_rentable_times_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.facility_rentable_times
    ADD CONSTRAINT facility_rentable_times_facility_id_fkey FOREIGN KEY (club_facility_id) REFERENCES public.club_facilities(id) ON DELETE CASCADE;


--
-- Name: instructor_certifications instructor_certifications_instructor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructor_certifications
    ADD CONSTRAINT instructor_certifications_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.club_instructors(id) ON DELETE CASCADE;


--
-- Name: instructor_reviews instructor_reviews_instructor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructor_reviews
    ADD CONSTRAINT instructor_reviews_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.club_instructors(id) ON DELETE CASCADE;


--
-- Name: instructor_reviews instructor_reviews_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructor_reviews
    ADD CONSTRAINT instructor_reviews_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.club_members(id) ON DELETE CASCADE;


--
-- Name: member_acquired_skills member_acquired_skills_acquired_from_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_acquired_skills
    ADD CONSTRAINT member_acquired_skills_acquired_from_activity_id_fkey FOREIGN KEY (acquired_from_activity_id) REFERENCES public.activities(id) ON DELETE SET NULL;


--
-- Name: member_acquired_skills member_acquired_skills_membership_history_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_acquired_skills
    ADD CONSTRAINT member_acquired_skills_membership_history_id_fkey FOREIGN KEY (membership_history_id) REFERENCES public.membership_history(id) ON DELETE CASCADE;


--
-- Name: membership_history membership_history_child_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_history
    ADD CONSTRAINT membership_history_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.children(id) ON DELETE CASCADE;


--
-- Name: membership_history membership_history_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_history
    ADD CONSTRAINT membership_history_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: membership_history membership_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_history
    ADD CONSTRAINT membership_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: membership_requests membership_requests_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_requests
    ADD CONSTRAINT membership_requests_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: membership_requests membership_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_requests
    ADD CONSTRAINT membership_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);


--
-- Name: membership_requests membership_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_requests
    ADD CONSTRAINT membership_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: package_activities package_activities_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_activities
    ADD CONSTRAINT package_activities_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: package_activities package_activities_instructor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_activities
    ADD CONSTRAINT package_activities_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.club_instructors(id) ON DELETE SET NULL;


--
-- Name: package_activities package_activities_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_activities
    ADD CONSTRAINT package_activities_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.club_packages(id) ON DELETE CASCADE;


--
-- Name: package_enrollments package_enrollments_enrollment_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_enrollments
    ADD CONSTRAINT package_enrollments_enrollment_transaction_id_fkey FOREIGN KEY (enrollment_transaction_id) REFERENCES public.transaction_ledger(id);


--
-- Name: package_enrollments package_enrollments_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_enrollments
    ADD CONSTRAINT package_enrollments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.club_members(id) ON DELETE CASCADE;


--
-- Name: package_enrollments package_enrollments_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_enrollments
    ADD CONSTRAINT package_enrollments_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.club_packages(id) ON DELETE CASCADE;


--
-- Name: package_enrollments package_enrollments_package_price_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_enrollments
    ADD CONSTRAINT package_enrollments_package_price_version_id_fkey FOREIGN KEY (package_price_version_id) REFERENCES public.package_price_history(id);


--
-- Name: package_enrollments package_enrollments_package_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_enrollments
    ADD CONSTRAINT package_enrollments_package_transaction_id_fkey FOREIGN KEY (package_transaction_id) REFERENCES public.transaction_ledger(id);


--
-- Name: package_price_history package_price_history_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_price_history
    ADD CONSTRAINT package_price_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: package_price_history package_price_history_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_price_history
    ADD CONSTRAINT package_price_history_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.club_packages(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: transaction_history transaction_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_history
    ADD CONSTRAINT transaction_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: transaction_history transaction_history_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_history
    ADD CONSTRAINT transaction_history_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transaction_ledger(id) ON DELETE CASCADE;


--
-- Name: transaction_ledger transaction_ledger_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_ledger
    ADD CONSTRAINT transaction_ledger_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: transaction_ledger transaction_ledger_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_ledger
    ADD CONSTRAINT transaction_ledger_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: transaction_ledger transaction_ledger_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_ledger
    ADD CONSTRAINT transaction_ledger_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: transaction_ledger transaction_ledger_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_ledger
    ADD CONSTRAINT transaction_ledger_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.package_enrollments(id) ON DELETE SET NULL;


--
-- Name: transaction_ledger transaction_ledger_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_ledger
    ADD CONSTRAINT transaction_ledger_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.club_members(id) ON DELETE SET NULL;


--
-- Name: transaction_ledger transaction_ledger_package_price_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_ledger
    ADD CONSTRAINT transaction_ledger_package_price_version_id_fkey FOREIGN KEY (package_price_version_id) REFERENCES public.package_price_history(id) ON DELETE SET NULL;


--
-- Name: transaction_ledger transaction_ledger_refunded_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_ledger
    ADD CONSTRAINT transaction_ledger_refunded_transaction_id_fkey FOREIGN KEY (refunded_transaction_id) REFERENCES public.transaction_ledger(id);


--
-- Name: transaction_ledger transaction_ledger_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_ledger
    ADD CONSTRAINT transaction_ledger_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: club_members Admins can create club members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can create club members" ON public.club_members FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: children Admins can delete all children; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete all children" ON public.children FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: clubs Admins can delete clubs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete clubs" ON public.clubs FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: children Admins can insert children for any user; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert children for any user" ON public.children FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: clubs Admins can insert clubs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert clubs" ON public.clubs FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: activities Admins can manage activities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage activities" ON public.activities USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: activity_schedules Admins can manage activity schedules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage activity schedules" ON public.activity_schedules USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: activity_skills Admins can manage activity skills; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage activity skills" ON public.activity_skills USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: instructor_reviews Admins can manage all instructor reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage all instructor reviews" ON public.instructor_reviews USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: club_reviews Admins can manage all reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage all reviews" ON public.club_reviews USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: bank_accounts Admins can manage bank accounts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage bank accounts" ON public.bank_accounts USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: club_amenities Admins can manage club amenities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage club amenities" ON public.club_amenities USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: club_classes Admins can manage club classes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage club classes" ON public.club_classes USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: club_instructors Admins can manage club instructors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage club instructors" ON public.club_instructors USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: club_packages Admins can manage club packages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage club packages" ON public.club_packages USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: club_partners Admins can manage club partners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage club partners" ON public.club_partners USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: club_pictures Admins can manage club pictures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage club pictures" ON public.club_pictures USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: club_community_posts Admins can manage club posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage club posts" ON public.club_community_posts USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: club_products Admins can manage club products; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage club products" ON public.club_products USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: club_statistics Admins can manage club statistics; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage club statistics" ON public.club_statistics USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: club_facilities Admins can manage facilities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage facilities" ON public.club_facilities USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: facility_pictures Admins can manage facility pictures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage facility pictures" ON public.facility_pictures USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: instructor_certifications Admins can manage instructor certifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage instructor certifications" ON public.instructor_certifications USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: transaction_ledger Admins can manage ledger entries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage ledger entries" ON public.transaction_ledger USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'super_admin'::public.app_role, 'business_owner'::public.app_role]))))));


--
-- Name: member_acquired_skills Admins can manage member acquired skills; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage member acquired skills" ON public.member_acquired_skills USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: membership_history Admins can manage membership history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage membership history" ON public.membership_history USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: facility_operating_hours Admins can manage operating hours; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage operating hours" ON public.facility_operating_hours USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: package_activities Admins can manage package activities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage package activities" ON public.package_activities USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: package_enrollments Admins can manage package enrollments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage package enrollments" ON public.package_enrollments USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: package_price_history Admins can manage price history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage price history" ON public.package_price_history USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'super_admin'::public.app_role, 'business_owner'::public.app_role]))))));


--
-- Name: facility_rentable_times Admins can manage rentable times; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage rentable times" ON public.facility_rentable_times USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: transaction_history Admins can manage transaction history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage transaction history" ON public.transaction_history USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: children Admins can update all children; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update all children" ON public.children FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: profiles Admins can update all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: club_members Admins can update club members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update club members" ON public.club_members FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: clubs Admins can update clubs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update clubs" ON public.clubs FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: membership_requests Admins can update requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update requests" ON public.membership_requests FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: children Admins can view all children; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all children" ON public.children FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: membership_requests Admins can view all requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all requests" ON public.membership_requests FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: club_members Admins can view club members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view club members" ON public.club_members FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: activities Anyone can view activities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view activities" ON public.activities FOR SELECT USING (true);


--
-- Name: activity_schedules Anyone can view activity schedules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view activity schedules" ON public.activity_schedules FOR SELECT USING (true);


--
-- Name: activity_skills Anyone can view activity skills; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view activity skills" ON public.activity_skills FOR SELECT USING (true);


--
-- Name: club_amenities Anyone can view club amenities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view club amenities" ON public.club_amenities FOR SELECT USING (true);


--
-- Name: club_classes Anyone can view club classes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view club classes" ON public.club_classes FOR SELECT USING (true);


--
-- Name: club_instructors Anyone can view club instructors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view club instructors" ON public.club_instructors FOR SELECT USING (true);


--
-- Name: club_members Anyone can view club members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view club members" ON public.club_members FOR SELECT USING (true);


--
-- Name: club_packages Anyone can view club packages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view club packages" ON public.club_packages FOR SELECT USING (true);


--
-- Name: club_partners Anyone can view club partners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view club partners" ON public.club_partners FOR SELECT USING (true);


--
-- Name: club_pictures Anyone can view club pictures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view club pictures" ON public.club_pictures FOR SELECT USING (true);


--
-- Name: club_community_posts Anyone can view club posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view club posts" ON public.club_community_posts FOR SELECT USING (true);


--
-- Name: club_products Anyone can view club products; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view club products" ON public.club_products FOR SELECT USING (true);


--
-- Name: club_reviews Anyone can view club reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view club reviews" ON public.club_reviews FOR SELECT USING (true);


--
-- Name: club_statistics Anyone can view club statistics; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view club statistics" ON public.club_statistics FOR SELECT USING (true);


--
-- Name: clubs Anyone can view clubs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view clubs" ON public.clubs FOR SELECT USING (true);


--
-- Name: club_facilities Anyone can view facilities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view facilities" ON public.club_facilities FOR SELECT USING (true);


--
-- Name: facility_pictures Anyone can view facility pictures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view facility pictures" ON public.facility_pictures FOR SELECT USING (true);


--
-- Name: instructor_certifications Anyone can view instructor certifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view instructor certifications" ON public.instructor_certifications FOR SELECT USING (true);


--
-- Name: instructor_reviews Anyone can view instructor reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view instructor reviews" ON public.instructor_reviews FOR SELECT USING (true);


--
-- Name: facility_operating_hours Anyone can view operating hours; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view operating hours" ON public.facility_operating_hours FOR SELECT USING (true);


--
-- Name: package_activities Anyone can view package activities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view package activities" ON public.package_activities FOR SELECT USING (true);


--
-- Name: package_enrollments Anyone can view package enrollments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view package enrollments" ON public.package_enrollments FOR SELECT USING (true);


--
-- Name: package_price_history Anyone can view price history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view price history" ON public.package_price_history FOR SELECT USING (true);


--
-- Name: facility_rentable_times Anyone can view rentable times; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view rentable times" ON public.facility_rentable_times FOR SELECT USING (true);


--
-- Name: clubs Business owners can create clubs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Business owners can create clubs" ON public.clubs FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'business_owner'::public.app_role) AND (business_owner_id = auth.uid())));


--
-- Name: clubs Business owners can update their own clubs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Business owners can update their own clubs" ON public.clubs FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'business_owner'::public.app_role) AND (business_owner_id = auth.uid()))) WITH CHECK ((public.has_role(auth.uid(), 'business_owner'::public.app_role) AND (business_owner_id = auth.uid())));


--
-- Name: clubs Business owners can view their own clubs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Business owners can view their own clubs" ON public.clubs FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'business_owner'::public.app_role) AND (business_owner_id = auth.uid())));


--
-- Name: conversations Club owners can create conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Club owners can create conversations" ON public.conversations FOR INSERT WITH CHECK (((club_id IN ( SELECT clubs.id
   FROM public.clubs
  WHERE (clubs.business_owner_id = auth.uid()))) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: notifications Club owners can create notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Club owners can create notifications" ON public.notifications FOR INSERT WITH CHECK (((club_id IN ( SELECT clubs.id
   FROM public.clubs
  WHERE (clubs.business_owner_id = auth.uid()))) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: messages Club owners can mark messages as read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Club owners can mark messages as read" ON public.messages FOR UPDATE USING ((conversation_id IN ( SELECT c.id
   FROM (public.conversations c
     JOIN public.clubs cl ON ((c.club_id = cl.id)))
  WHERE ((cl.business_owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)))));


--
-- Name: messages Club owners can send messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Club owners can send messages" ON public.messages FOR INSERT WITH CHECK (((sender_id = auth.uid()) AND (conversation_id IN ( SELECT c.id
   FROM (public.conversations c
     JOIN public.clubs cl ON ((c.club_id = cl.id)))
  WHERE ((cl.business_owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))))));


--
-- Name: conversations Club owners can view club conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Club owners can view club conversations" ON public.conversations FOR SELECT USING (((club_id IN ( SELECT clubs.id
   FROM public.clubs
  WHERE (clubs.business_owner_id = auth.uid()))) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: messages Club owners can view club messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Club owners can view club messages" ON public.messages FOR SELECT USING ((conversation_id IN ( SELECT c.id
   FROM (public.conversations c
     JOIN public.clubs cl ON ((c.club_id = cl.id)))
  WHERE ((cl.business_owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)))));


--
-- Name: transaction_ledger Club owners can view their club's ledger; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Club owners can view their club's ledger" ON public.transaction_ledger FOR SELECT USING ((club_id IN ( SELECT clubs.id
   FROM public.clubs
  WHERE (clubs.business_owner_id = auth.uid()))));


--
-- Name: conversations Members can create conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members can create conversations" ON public.conversations FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.club_members
  WHERE ((club_members.club_id = conversations.club_id) AND ((club_members.user_id = auth.uid()) OR (club_members.child_id IN ( SELECT children.id
           FROM public.children
          WHERE (children.parent_user_id = auth.uid())))))))));


--
-- Name: instructor_reviews Members can create instructor reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members can create instructor reviews" ON public.instructor_reviews FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.club_members
  WHERE ((club_members.id = instructor_reviews.member_id) AND (club_members.is_active = true)))));


--
-- Name: club_reviews Members can delete their own reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members can delete their own reviews" ON public.club_reviews FOR DELETE TO authenticated USING (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.club_members
  WHERE ((club_members.club_id = club_reviews.club_id) AND (club_members.user_id = auth.uid()))))));


--
-- Name: instructor_reviews Members can delete their own reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members can delete their own reviews" ON public.instructor_reviews FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.club_members
  WHERE ((club_members.id = instructor_reviews.member_id) AND (club_members.is_active = true)))));


--
-- Name: club_reviews Members can update their own reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members can update their own reviews" ON public.club_reviews FOR UPDATE TO authenticated USING (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.club_members
  WHERE ((club_members.club_id = club_reviews.club_id) AND (club_members.user_id = auth.uid()))))));


--
-- Name: instructor_reviews Members can update their own reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members can update their own reviews" ON public.instructor_reviews FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.club_members
  WHERE ((club_members.id = instructor_reviews.member_id) AND (club_members.is_active = true)))));


--
-- Name: club_reviews Only members can create reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Only members can create reviews" ON public.club_reviews FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.club_members
  WHERE ((club_members.club_id = club_reviews.club_id) AND (club_members.user_id = auth.uid()))))));


--
-- Name: club_members Only super admins can delete members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Only super admins can delete members" ON public.club_members FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: notifications Super admins can manage all notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Super admins can manage all notifications" ON public.notifications USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: clubs Super admins can view all clubs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Super admins can view all clubs" ON public.clubs FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: membership_requests Users can create membership requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create membership requests" ON public.membership_requests FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (status = 'pending'::text)));


--
-- Name: children Users can delete their own children; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own children" ON public.children FOR DELETE USING ((auth.uid() = parent_user_id));


--
-- Name: children Users can insert their own children; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own children" ON public.children FOR INSERT WITH CHECK ((auth.uid() = parent_user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: messages Users can mark messages as read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can mark messages as read" ON public.messages FOR UPDATE USING ((conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE (conversations.user_id = auth.uid()))));


--
-- Name: messages Users can send messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (((sender_id = auth.uid()) AND (conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE (conversations.user_id = auth.uid())))));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: children Users can update their own children; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own children" ON public.children FOR UPDATE USING ((auth.uid() = parent_user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: messages Users can view own conversation messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own conversation messages" ON public.messages FOR SELECT USING ((conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE (conversations.user_id = auth.uid()))));


--
-- Name: conversations Users can view own conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: member_acquired_skills Users can view their own acquired skills; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own acquired skills" ON public.member_acquired_skills FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.membership_history mh
  WHERE ((mh.id = member_acquired_skills.membership_history_id) AND (mh.user_id = auth.uid())))));


--
-- Name: children Users can view their own children; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own children" ON public.children FOR SELECT USING ((auth.uid() = parent_user_id));


--
-- Name: membership_history Users can view their own membership history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own membership history" ON public.membership_history FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: membership_requests Users can view their own requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own requests" ON public.membership_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_schedules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.activity_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_skills; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.activity_skills ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_accounts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: children; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

--
-- Name: club_amenities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.club_amenities ENABLE ROW LEVEL SECURITY;

--
-- Name: club_classes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.club_classes ENABLE ROW LEVEL SECURITY;

--
-- Name: club_community_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.club_community_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: club_facilities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.club_facilities ENABLE ROW LEVEL SECURITY;

--
-- Name: club_instructors; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.club_instructors ENABLE ROW LEVEL SECURITY;

--
-- Name: club_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

--
-- Name: club_packages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.club_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: club_partners; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.club_partners ENABLE ROW LEVEL SECURITY;

--
-- Name: club_pictures; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.club_pictures ENABLE ROW LEVEL SECURITY;

--
-- Name: club_products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.club_products ENABLE ROW LEVEL SECURITY;

--
-- Name: club_reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.club_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: club_statistics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.club_statistics ENABLE ROW LEVEL SECURITY;

--
-- Name: clubs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: facility_operating_hours; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.facility_operating_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: facility_pictures; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.facility_pictures ENABLE ROW LEVEL SECURITY;

--
-- Name: facility_rentable_times; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.facility_rentable_times ENABLE ROW LEVEL SECURITY;

--
-- Name: instructor_certifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.instructor_certifications ENABLE ROW LEVEL SECURITY;

--
-- Name: instructor_reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.instructor_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: member_acquired_skills; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.member_acquired_skills ENABLE ROW LEVEL SECURITY;

--
-- Name: membership_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.membership_history ENABLE ROW LEVEL SECURITY;

--
-- Name: membership_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.membership_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: package_activities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.package_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: package_enrollments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.package_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: package_price_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.package_price_history ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: transaction_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;

--
-- Name: transaction_ledger; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.transaction_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION calculate_package_popularity(p_package_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.calculate_package_popularity(p_package_id uuid) TO anon;
GRANT ALL ON FUNCTION public.calculate_package_popularity(p_package_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_package_popularity(p_package_id uuid) TO service_role;


--
-- Name: FUNCTION decrement_club_members_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.decrement_club_members_count() TO anon;
GRANT ALL ON FUNCTION public.decrement_club_members_count() TO authenticated;
GRANT ALL ON FUNCTION public.decrement_club_members_count() TO service_role;


--
-- Name: FUNCTION generate_receipt_number(p_club_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_receipt_number(p_club_id uuid) TO anon;
GRANT ALL ON FUNCTION public.generate_receipt_number(p_club_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.generate_receipt_number(p_club_id uuid) TO service_role;


--
-- Name: FUNCTION get_registered_users_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_registered_users_count() TO anon;
GRANT ALL ON FUNCTION public.get_registered_users_count() TO authenticated;
GRANT ALL ON FUNCTION public.get_registered_users_count() TO service_role;


--
-- Name: FUNCTION get_user_role_for_login(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_role_for_login(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_role_for_login(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_role_for_login(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO anon;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;


--
-- Name: FUNCTION increment_club_members_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.increment_club_members_count() TO anon;
GRANT ALL ON FUNCTION public.increment_club_members_count() TO authenticated;
GRANT ALL ON FUNCTION public.increment_club_members_count() TO service_role;


--
-- Name: FUNCTION lookup_profile_for_login(identifier text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lookup_profile_for_login(identifier text) TO anon;
GRANT ALL ON FUNCTION public.lookup_profile_for_login(identifier text) TO authenticated;
GRANT ALL ON FUNCTION public.lookup_profile_for_login(identifier text) TO service_role;


--
-- Name: FUNCTION process_member_leave(p_member_id uuid, p_leave_reason text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.process_member_leave(p_member_id uuid, p_leave_reason text) TO anon;
GRANT ALL ON FUNCTION public.process_member_leave(p_member_id uuid, p_leave_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.process_member_leave(p_member_id uuid, p_leave_reason text) TO service_role;


--
-- Name: FUNCTION recalculate_all_package_popularity(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.recalculate_all_package_popularity() TO anon;
GRANT ALL ON FUNCTION public.recalculate_all_package_popularity() TO authenticated;
GRANT ALL ON FUNCTION public.recalculate_all_package_popularity() TO service_role;


--
-- Name: FUNCTION update_club_members_count_on_status_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_club_members_count_on_status_change() TO anon;
GRANT ALL ON FUNCTION public.update_club_members_count_on_status_change() TO authenticated;
GRANT ALL ON FUNCTION public.update_club_members_count_on_status_change() TO service_role;


--
-- Name: FUNCTION update_conversation_last_message(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_conversation_last_message() TO anon;
GRANT ALL ON FUNCTION public.update_conversation_last_message() TO authenticated;
GRANT ALL ON FUNCTION public.update_conversation_last_message() TO service_role;


--
-- Name: FUNCTION update_package_popularity(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_package_popularity() TO anon;
GRANT ALL ON FUNCTION public.update_package_popularity() TO authenticated;
GRANT ALL ON FUNCTION public.update_package_popularity() TO service_role;


--
-- Name: FUNCTION update_transaction_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_transaction_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_transaction_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_transaction_updated_at() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: TABLE activities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.activities TO anon;
GRANT ALL ON TABLE public.activities TO authenticated;
GRANT ALL ON TABLE public.activities TO service_role;


--
-- Name: TABLE activity_schedules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.activity_schedules TO anon;
GRANT ALL ON TABLE public.activity_schedules TO authenticated;
GRANT ALL ON TABLE public.activity_schedules TO service_role;


--
-- Name: TABLE activity_skills; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.activity_skills TO anon;
GRANT ALL ON TABLE public.activity_skills TO authenticated;
GRANT ALL ON TABLE public.activity_skills TO service_role;


--
-- Name: TABLE bank_accounts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bank_accounts TO anon;
GRANT ALL ON TABLE public.bank_accounts TO authenticated;
GRANT ALL ON TABLE public.bank_accounts TO service_role;


--
-- Name: TABLE children; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.children TO anon;
GRANT ALL ON TABLE public.children TO authenticated;
GRANT ALL ON TABLE public.children TO service_role;


--
-- Name: TABLE club_amenities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.club_amenities TO anon;
GRANT ALL ON TABLE public.club_amenities TO authenticated;
GRANT ALL ON TABLE public.club_amenities TO service_role;


--
-- Name: TABLE club_classes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.club_classes TO anon;
GRANT ALL ON TABLE public.club_classes TO authenticated;
GRANT ALL ON TABLE public.club_classes TO service_role;


--
-- Name: TABLE club_community_posts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.club_community_posts TO anon;
GRANT ALL ON TABLE public.club_community_posts TO authenticated;
GRANT ALL ON TABLE public.club_community_posts TO service_role;


--
-- Name: TABLE club_facilities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.club_facilities TO anon;
GRANT ALL ON TABLE public.club_facilities TO authenticated;
GRANT ALL ON TABLE public.club_facilities TO service_role;


--
-- Name: TABLE club_instructors; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.club_instructors TO anon;
GRANT ALL ON TABLE public.club_instructors TO authenticated;
GRANT ALL ON TABLE public.club_instructors TO service_role;


--
-- Name: TABLE club_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.club_members TO anon;
GRANT ALL ON TABLE public.club_members TO authenticated;
GRANT ALL ON TABLE public.club_members TO service_role;


--
-- Name: TABLE club_packages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.club_packages TO anon;
GRANT ALL ON TABLE public.club_packages TO authenticated;
GRANT ALL ON TABLE public.club_packages TO service_role;


--
-- Name: TABLE club_partners; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.club_partners TO anon;
GRANT ALL ON TABLE public.club_partners TO authenticated;
GRANT ALL ON TABLE public.club_partners TO service_role;


--
-- Name: TABLE club_pictures; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.club_pictures TO anon;
GRANT ALL ON TABLE public.club_pictures TO authenticated;
GRANT ALL ON TABLE public.club_pictures TO service_role;


--
-- Name: TABLE club_products; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.club_products TO anon;
GRANT ALL ON TABLE public.club_products TO authenticated;
GRANT ALL ON TABLE public.club_products TO service_role;


--
-- Name: TABLE club_reviews; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.club_reviews TO anon;
GRANT ALL ON TABLE public.club_reviews TO authenticated;
GRANT ALL ON TABLE public.club_reviews TO service_role;


--
-- Name: TABLE club_statistics; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.club_statistics TO anon;
GRANT ALL ON TABLE public.club_statistics TO authenticated;
GRANT ALL ON TABLE public.club_statistics TO service_role;


--
-- Name: TABLE clubs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.clubs TO anon;
GRANT ALL ON TABLE public.clubs TO authenticated;
GRANT ALL ON TABLE public.clubs TO service_role;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conversations TO anon;
GRANT ALL ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;


--
-- Name: TABLE facility_operating_hours; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.facility_operating_hours TO anon;
GRANT ALL ON TABLE public.facility_operating_hours TO authenticated;
GRANT ALL ON TABLE public.facility_operating_hours TO service_role;


--
-- Name: TABLE facility_pictures; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.facility_pictures TO anon;
GRANT ALL ON TABLE public.facility_pictures TO authenticated;
GRANT ALL ON TABLE public.facility_pictures TO service_role;


--
-- Name: TABLE facility_rentable_times; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.facility_rentable_times TO anon;
GRANT ALL ON TABLE public.facility_rentable_times TO authenticated;
GRANT ALL ON TABLE public.facility_rentable_times TO service_role;


--
-- Name: TABLE instructor_certifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.instructor_certifications TO anon;
GRANT ALL ON TABLE public.instructor_certifications TO authenticated;
GRANT ALL ON TABLE public.instructor_certifications TO service_role;


--
-- Name: TABLE instructor_reviews; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.instructor_reviews TO anon;
GRANT ALL ON TABLE public.instructor_reviews TO authenticated;
GRANT ALL ON TABLE public.instructor_reviews TO service_role;


--
-- Name: TABLE member_acquired_skills; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.member_acquired_skills TO anon;
GRANT ALL ON TABLE public.member_acquired_skills TO authenticated;
GRANT ALL ON TABLE public.member_acquired_skills TO service_role;


--
-- Name: TABLE membership_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.membership_history TO anon;
GRANT ALL ON TABLE public.membership_history TO authenticated;
GRANT ALL ON TABLE public.membership_history TO service_role;


--
-- Name: TABLE membership_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.membership_requests TO anon;
GRANT ALL ON TABLE public.membership_requests TO authenticated;
GRANT ALL ON TABLE public.membership_requests TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE package_activities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.package_activities TO anon;
GRANT ALL ON TABLE public.package_activities TO authenticated;
GRANT ALL ON TABLE public.package_activities TO service_role;


--
-- Name: TABLE package_enrollments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.package_enrollments TO anon;
GRANT ALL ON TABLE public.package_enrollments TO authenticated;
GRANT ALL ON TABLE public.package_enrollments TO service_role;


--
-- Name: TABLE package_price_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.package_price_history TO anon;
GRANT ALL ON TABLE public.package_price_history TO authenticated;
GRANT ALL ON TABLE public.package_price_history TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE transaction_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.transaction_history TO anon;
GRANT ALL ON TABLE public.transaction_history TO authenticated;
GRANT ALL ON TABLE public.transaction_history TO service_role;


--
-- Name: TABLE transaction_ledger; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.transaction_ledger TO anon;
GRANT ALL ON TABLE public.transaction_ledger TO authenticated;
GRANT ALL ON TABLE public.transaction_ledger TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict xz534rXalmxznHY6Nxp2sXLHdOYlf464gg1X9UgBtQOD7R8eRlhOPOkdWZ7pDiS

