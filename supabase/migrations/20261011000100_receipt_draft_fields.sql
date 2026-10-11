alter table public.receipts
  alter column restaurant_id drop not null,
  alter column receipt_date drop not null,
  alter column total_minor drop not null,
  alter column currency drop not null;

alter table public.receipts
  add constraint receipts_non_draft_complete_check check (
    status = 'draft'
    or (
      restaurant_id is not null
      and receipt_date is not null
      and total_minor is not null
      and currency is not null
    )
  );
