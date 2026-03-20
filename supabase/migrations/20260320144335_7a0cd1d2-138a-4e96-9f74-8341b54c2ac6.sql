
ALTER TABLE public.site_config 
  ADD COLUMN competitor_columns jsonb NOT NULL DEFAULT '["CarMax","Carvana","Private Sale"]'::jsonb,
  ADD COLUMN comparison_features jsonb NOT NULL DEFAULT '[
    {"label":"Same-Day Cash Offer","values":[true,true,true,false]},
    {"label":"No Strangers at Your Home","values":[true,true,true,false]},
    {"label":"Top-Dollar Pricing","values":[true,"partial","partial",true]},
    {"label":"We Handle All Paperwork","values":[true,true,true,false]},
    {"label":"Check on the Spot","values":[true,true,false,"partial"]},
    {"label":"Price Guarantee","values":[true,false,false,false]},
    {"label":"No Lowball Algorithm","values":[true,false,false,true]},
    {"label":"Personal Dealer Experience","values":[true,false,false,false]}
  ]'::jsonb;
