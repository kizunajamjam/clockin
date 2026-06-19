-- オーナーが自店の希望シフトを閲覧・更新できるポリシーを追加
CREATE POLICY "owner read shop shift_requests" ON shift_requests
  FOR SELECT USING (
    shop_id IN (
      SELECT s.id FROM shops s
      JOIN organizations o ON o.id = s.organization_id
      WHERE o.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "owner update shop shift_requests" ON shift_requests
  FOR UPDATE USING (
    shop_id IN (
      SELECT s.id FROM shops s
      JOIN organizations o ON o.id = s.organization_id
      WHERE o.owner_user_id = auth.uid()
    )
  );
