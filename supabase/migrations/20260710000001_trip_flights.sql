-- Flight information submitted by families for the Vietnam Adventure trip

CREATE TABLE public.trip_flights (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id           uuid REFERENCES public.trip_families(id),
  contact_name        text NOT NULL,
  contact_email       text NOT NULL,
  -- Outbound: home → Vietnam
  outbound_from       text,          -- departure city / airport
  outbound_dep_date   date,
  outbound_dep_time   time,
  outbound_flight     text,          -- flight number(s)
  outbound_arr_date   date,          -- arrival date in Vietnam
  outbound_arr_time   time,
  -- Return: Vietnam → home
  return_dep_date     date,
  return_dep_time     time,
  return_flight       text,
  return_arr_date     date,
  return_arr_time     time,
  -- Extra
  notes               text,
  source              text NOT NULL DEFAULT 'edge8.ai/vietnam-adventure-flight-info',
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_flights ENABLE ROW LEVEL SECURITY;

-- Service role can read/write everything; no public access
CREATE POLICY "service role full access"
  ON public.trip_flights
  USING (true)
  WITH CHECK (true);
