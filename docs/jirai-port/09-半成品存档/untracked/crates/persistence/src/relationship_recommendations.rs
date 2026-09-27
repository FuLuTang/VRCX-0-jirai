use serde::Serialize;
use serde_json::Value;
use crate::{DatabaseService, Error};
use crate::common::{normalize_text, ParamsBuilder};
use crate::ownership::{owner_id_for_filter, OwnerId};
use crate::realtime::{ensure_realtime_tables, normalize_user_table_prefix};

#[derive(Debug, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RelationshipEvidenceQueryInput { pub candidate_user_ids: Vec<String>, pub per_candidate_limit: usize, pub total_limit: usize }
#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RelationshipEvidenceOutput { pub owner_user_id: String, pub user_id: String, pub display_name: String, pub location: String, pub access_type: String, pub creator_user_id: Option<String>, pub start_ms: i64, pub end_ms: i64, pub self_present: bool }

pub fn relationship_evidence_query(db: &DatabaseService, owner: &OwnerId, input: RelationshipEvidenceQueryInput) -> Result<Vec<RelationshipEvidenceOutput>, Error> {
 let owner_text=normalize_text(owner.as_str()); if owner_text.is_empty(){return Ok(vec![])};
 let prefix=normalize_user_table_prefix(&owner_text)?; ensure_realtime_tables(db,&prefix)?;
 let owner_row=owner_id_for_filter(db,owner)?.value(); let per=input.per_candidate_limit.clamp(1,200); let total=input.total_limit.clamp(1,1000); let candidates:Vec<_>=input.candidate_user_ids.into_iter().map(|x|normalize_text(&x)).filter(|x|!x.is_empty()&&x!=&owner_text).take(20).collect(); let mut out=Vec::new();
 for user in candidates { if out.len()>=total {break}; let params=ParamsBuilder::new().set("user_id",user.clone()).set("limit",per as i64).build();
  for row in db.execute(&format!("SELECT user_id,display_name,previous_location,created_at,time FROM {prefix}_feed_gps WHERE user_id=@user_id AND time>0 ORDER BY id DESC LIMIT @limit"),&params)? { push(&mut out,&owner_text,&row,"public",None,false); if out.len()>=total {break} }
  if out.len()>=total {break}
  for row in db.execute(&format!("SELECT user_id,display_name,location,created_at,time FROM {prefix}_feed_online_offline WHERE user_id=@user_id AND type='Offline' AND time>0 ORDER BY id DESC LIMIT @limit"),&params)? { push(&mut out,&owner_text,&row,"public",None,false); if out.len()>=total {break} }
  if out.len()>=total {break}
  let game_params=ParamsBuilder::new().set("user_id",user.clone()).set("owner_id",owner_row).set("limit",per as i64).build();
  for row in db.execute("SELECT user_id,display_name,location,created_at,time FROM gamelog_join_leave WHERE owner_id IN (0,@owner_id) AND user_id=@user_id AND type='OnPlayerLeft' AND time>0 ORDER BY id DESC LIMIT @limit",&game_params)? { push(&mut out,&owner_text,&row,"public",None,true); if out.len()>=total {break} }
 }
 Ok(out)
}
fn push(out:&mut Vec<RelationshipEvidenceOutput>, owner:&str,row:&Vec<Value>,access:&str,creator:Option<String>,self_present:bool){ let location=row.get(2).and_then(Value::as_str).unwrap_or("").to_string(); let end=row.get(3).and_then(Value::as_str).and_then(|v|chrono::DateTime::parse_from_rfc3339(v).ok()).map(|v|v.timestamp_millis()).unwrap_or(0); let time=row.get(4).and_then(Value::as_i64).unwrap_or(0); if location.is_empty()||end<=0||time<=0{return} out.push(RelationshipEvidenceOutput{owner_user_id:owner.into(),user_id:row.first().and_then(Value::as_str).unwrap_or("").into(),display_name:row.get(1).and_then(Value::as_str).unwrap_or("").into(),location,access_type:access.into(),creator_user_id:creator,start_ms:end-time,end_ms:end,self_present}); }
