CREATE OR REPLACE FUNCTION public.get_customer_arrival_page(_token text)
RETURNS TABLE(
  submission_id uuid, customer_first_name text,
  vehicle_year text, vehicle_make text, vehicle_model text, vehicle_trim text,
  plate text, vin_last6 text, appointment_date text, appointment_time text,
  progress_status text, self_checkin_at timestamptz, self_checkin_status text,
  dealership_id text, dealership_name text, salesperson_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    s.id, split_part(coalesce(s.name,''), ' ', 1),
    s.vehicle_year::text, s.vehicle_make, s.vehicle_model, ''::text AS vehicle_trim,
    s.plate, right(coalesce(s.vin,''), 6),
    coalesce(to_char(a.preferred_date, 'YYYY-MM-DD'), ''), coalesce(a.preferred_time, ''),
    s.progress_status, s.self_checkin_at, s.self_checkin_status,
    s.dealership_id, coalesce(sc.dealership_name, ''),
    coalesce(p.display_name, p.email, '')
  FROM submissions s
  LEFT JOIN appointments a ON a.submission_token = s.token AND a.status NOT IN ('cancelled','completed')
  LEFT JOIN site_config sc ON sc.dealership_id = s.dealership_id
  LEFT JOIN profiles p ON p.user_id = s.assigned_salesperson_id
  WHERE s.token = _token
  ORDER BY a.preferred_date NULLS LAST, a.preferred_time NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_arrival_page(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';