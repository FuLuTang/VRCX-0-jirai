use serde_json::{Map, Value};
use vrcx_0_application_core::{FriendProjectionPatch, FriendStateBucketAuthority};
use vrcx_0_core::friends::{FriendRecord, OptionalCompactString};

use super::super::utils::parse_location;
use vrcx_0_core::json::JsonExt;

#[derive(Clone, Debug)]
pub(in crate::realtime::friends::runtime) enum FriendRecordPatch {
    Fields(Map<String, Value>),
    Full(Box<FriendRecord>),
}

impl FriendRecordPatch {
    pub(in crate::realtime::friends::runtime) fn from_value(value: &Value) -> Self {
        Self::Fields(value.as_object().cloned().unwrap_or_default())
    }

    pub(in crate::realtime::friends::runtime) fn from_record(record: &FriendRecord) -> Self {
        Self::Full(Box::new(record.clone()))
    }

    pub(in crate::realtime::friends::runtime) fn set_pending_offline(
        &mut self,
        pending_offline: bool,
    ) {
        let extra = match self {
            Self::Fields(fields) => fields,
            Self::Full(record) => &mut record.extra,
        };
        extra.insert("pendingOffline".into(), Value::Bool(pending_offline));
    }

    fn apply_to(&self, target: &mut FriendRecord) {
        match self {
            Self::Fields(fields) => apply_fields(target, fields),
            Self::Full(record) => {
                let previous_dates = [
                    target.date_joined.clone(),
                    target.last_activity.clone(),
                    target.last_login.clone(),
                    target.last_mobile.clone(),
                ];
                let mut existing_extra = std::mem::take(&mut target.extra);
                *target = record.as_ref().clone();
                for (date, previous) in [
                    &mut target.date_joined,
                    &mut target.last_activity,
                    &mut target.last_login,
                    &mut target.last_mobile,
                ]
                .into_iter()
                .zip(previous_dates)
                {
                    if date.is_missing() {
                        *date = previous;
                    }
                }
                existing_extra.extend(std::mem::take(&mut target.extra));
                target.extra = existing_extra;
            }
        }
    }
}

pub(super) struct FriendRecordTransition {
    pub(super) next: FriendRecord,
    pub(super) projection: FriendProjectionPatch,
    pub(super) was_traveling: bool,
}

pub(super) fn apply_friend_patch(
    previous: Option<&FriendRecord>,
    user_id: &str,
    patch: &FriendRecordPatch,
    state_bucket: &str,
    state_bucket_authority: FriendStateBucketAuthority,
) -> FriendRecordTransition {
    let mut next = previous.cloned().unwrap_or_default();
    let was_traveling = parse_location(&next.location).is_traveling;
    patch.apply_to(&mut next);
    next.id = user_id.to_string();
    next.state = state_bucket.into();
    sanitize_extra(&mut next);

    FriendRecordTransition {
        projection: FriendProjectionPatch {
            user_id: user_id.to_string(),
            patch: next.clone(),
            state_bucket_authority,
        },
        next,
        was_traveling,
    }
}

struct NamedField {
    keys: &'static [&'static str],
    get: fn(&FriendRecord) -> &str,
    set: Option<fn(&mut FriendRecord, &str)>,
}

const NAMED_FIELDS: &[NamedField] = &[
    NamedField {
        keys: &["id"],
        get: |record| &record.id,
        set: None,
    },
    NamedField {
        keys: &["displayName"],
        get: |record| &record.display_name,
        set: Some(|record, value| record.display_name = value.into()),
    },
    NamedField {
        keys: &["username"],
        get: |record| &record.username,
        set: Some(|record, value| record.username = value.to_string()),
    },
    NamedField {
        keys: &["state"],
        get: |record| &record.state,
        set: None,
    },
    NamedField {
        keys: &["location"],
        get: |record| &record.location,
        set: Some(|record, value| record.location = value.to_string()),
    },
    NamedField {
        keys: &["travelingToLocation"],
        get: |record| &record.traveling_to_location,
        set: Some(|record, value| record.traveling_to_location = value.to_string()),
    },
    NamedField {
        keys: &["worldId"],
        get: |record| &record.world_id,
        set: Some(|record, value| record.world_id = value.to_string()),
    },
    NamedField {
        keys: &["platform"],
        get: |record| &record.platform,
        set: Some(|record, value| record.platform = value.into()),
    },
    NamedField {
        keys: &["lastPlatform", "last_platform"],
        get: |record| &record.last_platform,
        set: Some(|record, value| record.last_platform = value.into()),
    },
    NamedField {
        keys: &["status"],
        get: |record| &record.status,
        set: Some(|record, value| record.status = value.into()),
    },
    NamedField {
        keys: &["statusDescription"],
        get: |record| &record.status_description,
        set: Some(|record, value| record.status_description = value.into()),
    },
    NamedField {
        keys: &["bio"],
        get: |record| &record.bio,
        set: Some(|record, value| record.bio = value.to_string()),
    },
    NamedField {
        keys: &["iconUrl"],
        get: |record| &record.icon_url,
        set: Some(|record, value| record.icon_url = value.to_string()),
    },
    NamedField {
        keys: &["currentAvatarImageUrl"],
        get: |record| &record.current_avatar_image_url,
        set: Some(|record, value| record.current_avatar_image_url = value.to_string()),
    },
    NamedField {
        keys: &["currentAvatarThumbnailImageUrl"],
        get: |record| &record.current_avatar_thumbnail_image_url,
        set: Some(|record, value| record.current_avatar_thumbnail_image_url = value.to_string()),
    },
    NamedField {
        keys: &["currentAvatarAuthorId"],
        get: |record| &record.current_avatar_author_id,
        set: Some(|record, value| record.current_avatar_author_id = value.to_string()),
    },
    NamedField {
        keys: &["currentAvatarName"],
        get: |record| &record.current_avatar_name,
        set: Some(|record, value| record.current_avatar_name = value.to_string()),
    },
];

struct OptionalField {
    key: &'static str,
    get: fn(&FriendRecord) -> &OptionalCompactString,
    set: fn(&mut FriendRecord, OptionalCompactString),
}

const OPTIONAL_FIELDS: &[OptionalField] = &[
    OptionalField {
        key: "date_joined",
        get: |record| &record.date_joined,
        set: |record, value| record.date_joined = value,
    },
    OptionalField {
        key: "last_activity",
        get: |record| &record.last_activity,
        set: |record, value| record.last_activity = value,
    },
    OptionalField {
        key: "last_login",
        get: |record| &record.last_login,
        set: |record, value| record.last_login = value,
    },
    OptionalField {
        key: "last_mobile",
        get: |record| &record.last_mobile,
        set: |record, value| record.last_mobile = value,
    },
];

fn named_field(key: &str) -> Option<&'static NamedField> {
    NAMED_FIELDS.iter().find(|field| field.keys.contains(&key))
}

fn optional_field(key: &str) -> Option<&'static OptionalField> {
    OPTIONAL_FIELDS.iter().find(|field| field.key == key)
}

fn is_named_key(key: &str) -> bool {
    named_field(key).is_some() || optional_field(key).is_some()
}

fn patch_str<'a>(patch: &'a Map<String, Value>, keys: &[&str]) -> Option<&'a str> {
    for key in keys {
        match patch.get(*key) {
            Some(Value::String(value)) => return Some(value),
            Some(Value::Null) | None => {}
            Some(other) => tracing::warn!(
                "friend patch field `{}` has non-string value: {}",
                *key,
                other
            ),
        }
    }
    None
}

fn apply_fields(record: &mut FriendRecord, patch: &Map<String, Value>) {
    for field in NAMED_FIELDS {
        let Some(set) = field.set else {
            continue;
        };
        if let Some(value) = patch_str(patch, field.keys) {
            set(record, value);
        }
    }
    for field in OPTIONAL_FIELDS {
        match patch.get(field.key) {
            Some(Value::String(value)) => (field.set)(record, value.as_str().into()),
            Some(Value::Null) => (field.set)(record, OptionalCompactString::null()),
            Some(other) => {
                tracing::warn!(
                    "friend patch field `{}` has non-string value: {other}",
                    field.key
                )
            }
            None => {}
        }
    }
    record.extra.extend(
        patch
            .iter()
            .filter(|(key, _)| !is_named_key(key))
            .map(|(key, value)| (key.clone(), value.clone())),
    );
}

fn sanitize_extra(record: &mut FriendRecord) {
    record.extra.retain(|key, _| !is_named_key(key));
}

pub(in crate::realtime::friends::runtime) fn record_string(
    record: &FriendRecord,
    key: &str,
) -> String {
    if let Some(field) = named_field(key) {
        return (field.get)(record).to_string();
    }
    if let Some(field) = optional_field(key) {
        return (field.get)(record).as_str().unwrap_or_default().to_string();
    }
    record.extra.text_field(key)
}

pub(in crate::realtime::friends::runtime) fn record_value(
    record: &FriendRecord,
    key: &str,
) -> Value {
    if let Some(field) = optional_field(key) {
        return (field.get)(record)
            .as_str()
            .map(|value| Value::String(value.to_string()))
            .unwrap_or(Value::Null);
    }
    if named_field(key).is_some() {
        return Value::String(record_string(record, key));
    }
    record.extra.get(key).cloned().unwrap_or(Value::Null)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn transition_normalizes_aliases_and_preserves_unknown_fields() {
        let previous = FriendRecord {
            id: "usr_x".into(),
            state: "active".into(),
            location: "offline".into(),
            status_description: "hi".into(),
            date_joined: "2026-01-01".into(),
            last_activity: "2026-01-02T03:04:05.000Z".into(),
            ..FriendRecord::default()
        };
        let patch = FriendRecordPatch::from_value(&json!({
            "last_platform": "standalonewindows",
            "location": "traveling",
            "statusDescription": Value::Null,
            "last_activity": null,
            "last_login": "2026-01-03T03:04:05.000Z",
            "$location": { "tag": "traveling" }
        }));
        let transition = apply_friend_patch(
            Some(&previous),
            "usr_x",
            &patch,
            "online",
            FriendStateBucketAuthority::Explicit,
        );

        assert_eq!(transition.next.last_platform, "standalonewindows");
        assert_eq!(transition.next.location, "traveling");
        assert_eq!(transition.next.status_description, "hi");
        assert_eq!(transition.next.date_joined.as_str(), Some("2026-01-01"));
        assert!(transition.next.last_activity.is_null());
        assert_eq!(
            transition.next.last_login.as_str(),
            Some("2026-01-03T03:04:05.000Z")
        );
        assert_eq!(transition.next.extra["$location"]["tag"], "traveling");
        assert!(transition
            .projection
            .patch
            .extra
            .get("last_platform")
            .is_none());
    }

    #[test]
    fn full_record_patch_preserves_dates_missing_from_replacement() {
        let previous = FriendRecord {
            state: "active".into(),
            id: "usr_x".into(),
            date_joined: "2026-01-01".into(),
            last_login: "2026-01-02T03:04:05.000Z".into(),
            ..FriendRecord::default()
        };
        let replacement = FriendRecord {
            id: "usr_x".into(),
            last_login: OptionalCompactString::null(),
            ..FriendRecord::default()
        };

        let transition = apply_friend_patch(
            Some(&previous),
            "usr_x",
            &FriendRecordPatch::from_record(&replacement),
            "offline",
            FriendStateBucketAuthority::Explicit,
        );

        assert_eq!(transition.next.date_joined.as_str(), Some("2026-01-01"));
        assert!(transition.next.last_login.is_null());
    }
}
