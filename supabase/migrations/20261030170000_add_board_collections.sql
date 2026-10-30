-- Task board: one board per project ("boards") and its issues ("issues").
alter table public.assets drop constraint if exists assets_collection_check;
alter table public.assets add constraint assets_collection_check check (collection in (
  'sprites', 'sounds', 'music', 'diagrams', 'stories', 'tilemaps', 'dialogues',
  'palettes', 'spritesheets', 'notes', 'boards', 'issues', 'links'));
