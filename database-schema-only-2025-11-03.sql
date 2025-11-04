--
-- PostgreSQL database dump
--

\restrict sSVyW9dcJj3Uelg8K5gTzp9mlTcto1KkhZSaETCnD3ey8E9CCBdJ5D4bHUFNvYZ

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

\unrestrict sSVyW9dcJj3Uelg8K5gTzp9mlTcto1KkhZSaETCnD3ey8E9CCBdJ5D4bHUFNvYZ

