-- 賃金台帳の法定記載事項（労基法108条）に「性別」が含まれるため追加
-- NULL許容（既存レコードおよび入力任意のため）
alter table staff add column gender text check (gender in ('male','female','other'));
