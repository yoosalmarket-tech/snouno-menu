-- The Snounu invoice prints on 80 mm receipt paper only.
-- Keep old approved invoice JSON unchanged for audit history.
update public.pay_settings
set paper = '80mm'
where paper <> '80mm';

alter table public.pay_settings
  alter column paper set default '80mm';

alter table public.pay_settings
  drop constraint if exists pay_settings_paper_check;

alter table public.pay_settings
  add constraint pay_settings_paper_check check (paper = '80mm');
