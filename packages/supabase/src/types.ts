export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
    graphql_public: {
        Tables: {
            [_ in never]: never;
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            graphql: {
                Args: {
                    extensions?: Json;
                    operationName?: string;
                    query?: string;
                    variables?: Json;
                };
                Returns: Json;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
    public: {
        Tables: {
            admin_audit_logs: {
                Row: {
                    action: string;
                    actor_id: string;
                    changes: Json | null;
                    created_at: string;
                    id: string;
                    target_id: string;
                    target_table: string;
                };
                Insert: {
                    action: string;
                    actor_id: string;
                    changes?: Json | null;
                    created_at?: string;
                    id?: string;
                    target_id: string;
                    target_table: string;
                };
                Update: {
                    action?: string;
                    actor_id?: string;
                    changes?: Json | null;
                    created_at?: string;
                    id?: string;
                    target_id?: string;
                    target_table?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'admin_audit_logs_actor_id_fkey';
                        columns: ['actor_id'];
                        isOneToOne: false;
                        referencedRelation: 'admin_users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            admin_users: {
                Row: {
                    created_at: string;
                    deleted_at: string | null;
                    display_name: string;
                    id: string;
                    role: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    deleted_at?: string | null;
                    display_name: string;
                    id: string;
                    role?: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    deleted_at?: string | null;
                    display_name?: string;
                    id?: string;
                    role?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            application_sheets: {
                Row: {
                    age: number | null;
                    birth_on: string | null;
                    contact_lens_type: string | null;
                    created_at: string;
                    dive_count: number | null;
                    dive_shop_id: string | null;
                    dry_suit_dive_count: number | null;
                    emergency_contact_phone: string;
                    emergency_contact_relation: string;
                    foot_size_cm: number | null;
                    full_name: string;
                    gender: string | null;
                    has_contact_lens: boolean | null;
                    has_dry_suit_experience: boolean | null;
                    has_rental: boolean | null;
                    height_cm: number | null;
                    id: string;
                    kind: string;
                    last_dive_year_month: string | null;
                    license_rank: string;
                    name: string;
                    nearest_station: string;
                    needs_prescription_mask: boolean | null;
                    omit_rental_block: boolean;
                    phone: string;
                    rental_items: Json;
                    updated_at: string;
                    user_id: string;
                    weight_kg: number | null;
                };
                Insert: {
                    age?: number | null;
                    birth_on?: string | null;
                    contact_lens_type?: string | null;
                    created_at?: string;
                    dive_count?: number | null;
                    dive_shop_id?: string | null;
                    dry_suit_dive_count?: number | null;
                    emergency_contact_phone?: string;
                    emergency_contact_relation?: string;
                    foot_size_cm?: number | null;
                    full_name?: string;
                    gender?: string | null;
                    has_contact_lens?: boolean | null;
                    has_dry_suit_experience?: boolean | null;
                    has_rental?: boolean | null;
                    height_cm?: number | null;
                    id?: string;
                    kind?: string;
                    last_dive_year_month?: string | null;
                    license_rank?: string;
                    name: string;
                    nearest_station?: string;
                    needs_prescription_mask?: boolean | null;
                    omit_rental_block?: boolean;
                    phone?: string;
                    rental_items?: Json;
                    updated_at?: string;
                    user_id: string;
                    weight_kg?: number | null;
                };
                Update: {
                    age?: number | null;
                    birth_on?: string | null;
                    contact_lens_type?: string | null;
                    created_at?: string;
                    dive_count?: number | null;
                    dive_shop_id?: string | null;
                    dry_suit_dive_count?: number | null;
                    emergency_contact_phone?: string;
                    emergency_contact_relation?: string;
                    foot_size_cm?: number | null;
                    full_name?: string;
                    gender?: string | null;
                    has_contact_lens?: boolean | null;
                    has_dry_suit_experience?: boolean | null;
                    has_rental?: boolean | null;
                    height_cm?: number | null;
                    id?: string;
                    kind?: string;
                    last_dive_year_month?: string | null;
                    license_rank?: string;
                    name?: string;
                    nearest_station?: string;
                    needs_prescription_mask?: boolean | null;
                    omit_rental_block?: boolean;
                    phone?: string;
                    rental_items?: Json;
                    updated_at?: string;
                    user_id?: string;
                    weight_kg?: number | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'application_sheets_dive_shop_id_fkey';
                        columns: ['dive_shop_id'];
                        isOneToOne: false;
                        referencedRelation: 'dive_shops';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'application_sheets_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            certification_tags: {
                Row: {
                    certification_id: string;
                    tag: string;
                };
                Insert: {
                    certification_id: string;
                    tag: string;
                };
                Update: {
                    certification_id?: string;
                    tag?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'certification_tags_certification_id_fkey';
                        columns: ['certification_id'];
                        isOneToOne: false;
                        referencedRelation: 'certifications';
                        referencedColumns: ['id'];
                    },
                ];
            };
            certifications: {
                Row: {
                    acquired_location: string | null;
                    acquired_on: string;
                    agency: string;
                    created_at: string;
                    dive_id: string | null;
                    diver_number: string | null;
                    id: string;
                    instructor_number: string | null;
                    rank: string;
                    trained_by: string | null;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    acquired_location?: string | null;
                    acquired_on: string;
                    agency: string;
                    created_at?: string;
                    dive_id?: string | null;
                    diver_number?: string | null;
                    id?: string;
                    instructor_number?: string | null;
                    rank: string;
                    trained_by?: string | null;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    acquired_location?: string | null;
                    acquired_on?: string;
                    agency?: string;
                    created_at?: string;
                    dive_id?: string | null;
                    diver_number?: string | null;
                    id?: string;
                    instructor_number?: string | null;
                    rank?: string;
                    trained_by?: string | null;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'certifications_dive_id_fkey';
                        columns: ['dive_id'];
                        isOneToOne: false;
                        referencedRelation: 'dives';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'certifications_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            dive_likes: {
                Row: {
                    created_at: string;
                    dive_id: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    dive_id: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    dive_id?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'dive_likes_dive_id_fkey';
                        columns: ['dive_id'];
                        isOneToOne: false;
                        referencedRelation: 'dives';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'dive_likes_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            dive_log_buddies: {
                Row: {
                    buddy_name: string | null;
                    buddy_user_id: string | null;
                    created_at: string;
                    dive_id: string;
                    id: string;
                    removed_by_buddy: boolean;
                };
                Insert: {
                    buddy_name?: string | null;
                    buddy_user_id?: string | null;
                    created_at?: string;
                    dive_id: string;
                    id?: string;
                    removed_by_buddy?: boolean;
                };
                Update: {
                    buddy_name?: string | null;
                    buddy_user_id?: string | null;
                    created_at?: string;
                    dive_id?: string;
                    id?: string;
                    removed_by_buddy?: boolean;
                };
                Relationships: [
                    {
                        foreignKeyName: 'dive_log_buddies_buddy_user_id_fkey';
                        columns: ['buddy_user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'dive_log_buddies_dive_id_fkey';
                        columns: ['dive_id'];
                        isOneToOne: false;
                        referencedRelation: 'dives';
                        referencedColumns: ['id'];
                    },
                ];
            };
            dive_photos: {
                Row: {
                    caption: string;
                    created_at: string;
                    deleted_at: string | null;
                    display_path: string;
                    dive_id: string;
                    height: number | null;
                    id: string;
                    is_cover: boolean;
                    sort_order: number;
                    thumb_path: string;
                    updated_at: string;
                    user_id: string;
                    width: number | null;
                };
                Insert: {
                    caption?: string;
                    created_at?: string;
                    deleted_at?: string | null;
                    display_path: string;
                    dive_id: string;
                    height?: number | null;
                    id?: string;
                    is_cover?: boolean;
                    sort_order?: number;
                    thumb_path: string;
                    updated_at?: string;
                    user_id: string;
                    width?: number | null;
                };
                Update: {
                    caption?: string;
                    created_at?: string;
                    deleted_at?: string | null;
                    display_path?: string;
                    dive_id?: string;
                    height?: number | null;
                    id?: string;
                    is_cover?: boolean;
                    sort_order?: number;
                    thumb_path?: string;
                    updated_at?: string;
                    user_id?: string;
                    width?: number | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'dive_photos_dive_id_fkey';
                        columns: ['dive_id'];
                        isOneToOne: false;
                        referencedRelation: 'dives';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'dive_photos_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            dive_plans: {
                Row: {
                    created_at: string;
                    dive_shop_id: string | null;
                    id: string;
                    location: string;
                    notes: string | null;
                    packing_completed_at: string | null;
                    planned_on: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    dive_shop_id?: string | null;
                    id?: string;
                    location: string;
                    notes?: string | null;
                    packing_completed_at?: string | null;
                    planned_on: string;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    dive_shop_id?: string | null;
                    id?: string;
                    location?: string;
                    notes?: string | null;
                    packing_completed_at?: string | null;
                    planned_on?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'dive_plans_dive_shop_id_fkey';
                        columns: ['dive_shop_id'];
                        isOneToOne: false;
                        referencedRelation: 'dive_shops';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'dive_plans_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            dive_shops: {
                Row: {
                    address: string;
                    created_at: string;
                    id: string;
                    latitude: number | null;
                    longitude: number | null;
                    memo: string;
                    name: string;
                    phone: string;
                    updated_at: string;
                    user_id: string;
                    website_url: string;
                };
                Insert: {
                    address?: string;
                    created_at?: string;
                    id?: string;
                    latitude?: number | null;
                    longitude?: number | null;
                    memo?: string;
                    name: string;
                    phone?: string;
                    updated_at?: string;
                    user_id: string;
                    website_url?: string;
                };
                Update: {
                    address?: string;
                    created_at?: string;
                    id?: string;
                    latitude?: number | null;
                    longitude?: number | null;
                    memo?: string;
                    name?: string;
                    phone?: string;
                    updated_at?: string;
                    user_id?: string;
                    website_url?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'dive_shops_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            dive_sites: {
                Row: {
                    area: string | null;
                    country: string;
                    created_at: string;
                    deleted_at: string | null;
                    description: string | null;
                    id: string;
                    name: string;
                    updated_at: string;
                };
                Insert: {
                    area?: string | null;
                    country?: string;
                    created_at?: string;
                    deleted_at?: string | null;
                    description?: string | null;
                    id?: string;
                    name: string;
                    updated_at?: string;
                };
                Update: {
                    area?: string | null;
                    country?: string;
                    created_at?: string;
                    deleted_at?: string | null;
                    description?: string | null;
                    id?: string;
                    name?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            dives: {
                Row: {
                    air_temp_c: number | null;
                    avg_depth_m: number | null;
                    bottom_time_min: number;
                    buddy_name: string | null;
                    certification_dive: boolean;
                    created_at: string;
                    current_condition: string | null;
                    deleted_at: string | null;
                    dive_date: string;
                    dive_number: number | null;
                    dive_shop_id: string | null;
                    dive_site_id: string | null;
                    dive_type: string | null;
                    entry_time: string | null;
                    equipment_notes: string | null;
                    exit_time: string | null;
                    gas_type: string | null;
                    id: string;
                    instructor_name: string | null;
                    is_public: boolean;
                    location: string | null;
                    max_depth_m: number;
                    notes: string | null;
                    o2_percent: number | null;
                    pressure_end_bar: number | null;
                    pressure_start_bar: number | null;
                    public_slug: string | null;
                    suit_type: string | null;
                    tank_type: string | null;
                    tank_volume_l: number | null;
                    updated_at: string;
                    user_id: string;
                    visibility_m: number | null;
                    water_temp_c: number | null;
                    wave: string | null;
                    weather: string | null;
                    weight_kg: number | null;
                };
                Insert: {
                    air_temp_c?: number | null;
                    avg_depth_m?: number | null;
                    bottom_time_min: number;
                    buddy_name?: string | null;
                    certification_dive?: boolean;
                    created_at?: string;
                    current_condition?: string | null;
                    deleted_at?: string | null;
                    dive_date: string;
                    dive_number?: number | null;
                    dive_shop_id?: string | null;
                    dive_site_id?: string | null;
                    dive_type?: string | null;
                    entry_time?: string | null;
                    equipment_notes?: string | null;
                    exit_time?: string | null;
                    gas_type?: string | null;
                    id?: string;
                    instructor_name?: string | null;
                    is_public?: boolean;
                    location?: string | null;
                    max_depth_m: number;
                    notes?: string | null;
                    o2_percent?: number | null;
                    pressure_end_bar?: number | null;
                    pressure_start_bar?: number | null;
                    public_slug?: string | null;
                    suit_type?: string | null;
                    tank_type?: string | null;
                    tank_volume_l?: number | null;
                    updated_at?: string;
                    user_id: string;
                    visibility_m?: number | null;
                    water_temp_c?: number | null;
                    wave?: string | null;
                    weather?: string | null;
                    weight_kg?: number | null;
                };
                Update: {
                    air_temp_c?: number | null;
                    avg_depth_m?: number | null;
                    bottom_time_min?: number;
                    buddy_name?: string | null;
                    certification_dive?: boolean;
                    created_at?: string;
                    current_condition?: string | null;
                    deleted_at?: string | null;
                    dive_date?: string;
                    dive_number?: number | null;
                    dive_shop_id?: string | null;
                    dive_site_id?: string | null;
                    dive_type?: string | null;
                    entry_time?: string | null;
                    equipment_notes?: string | null;
                    exit_time?: string | null;
                    gas_type?: string | null;
                    id?: string;
                    instructor_name?: string | null;
                    is_public?: boolean;
                    location?: string | null;
                    max_depth_m?: number;
                    notes?: string | null;
                    o2_percent?: number | null;
                    pressure_end_bar?: number | null;
                    pressure_start_bar?: number | null;
                    public_slug?: string | null;
                    suit_type?: string | null;
                    tank_type?: string | null;
                    tank_volume_l?: number | null;
                    updated_at?: string;
                    user_id?: string;
                    visibility_m?: number | null;
                    water_temp_c?: number | null;
                    wave?: string | null;
                    weather?: string | null;
                    weight_kg?: number | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'dives_dive_shop_id_fkey';
                        columns: ['dive_shop_id'];
                        isOneToOne: false;
                        referencedRelation: 'dive_shops';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'dives_dive_site_id_fkey';
                        columns: ['dive_site_id'];
                        isOneToOne: false;
                        referencedRelation: 'dive_sites';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'dives_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            inquiries: {
                Row: {
                    body: string;
                    category: string;
                    created_at: string;
                    email: string;
                    id: string;
                    name: string;
                    submitter_ip: unknown;
                    submitter_user_id: string | null;
                };
                Insert: {
                    body: string;
                    category: string;
                    created_at?: string;
                    email: string;
                    id?: string;
                    name: string;
                    submitter_ip?: unknown;
                    submitter_user_id?: string | null;
                };
                Update: {
                    body?: string;
                    category?: string;
                    created_at?: string;
                    email?: string;
                    id?: string;
                    name?: string;
                    submitter_ip?: unknown;
                    submitter_user_id?: string | null;
                };
                Relationships: [];
            };
            log_credit_balances: {
                Row: {
                    balance: number;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    balance?: number;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    balance?: number;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'log_credit_balances_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: true;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            log_credit_ledger: {
                Row: {
                    amount: number;
                    created_at: string;
                    dive_id: string | null;
                    granted_on: string | null;
                    id: string;
                    kind: string;
                    purchase_id: string | null;
                    stripe_refund_id: string | null;
                    user_id: string;
                };
                Insert: {
                    amount: number;
                    created_at?: string;
                    dive_id?: string | null;
                    granted_on?: string | null;
                    id?: string;
                    kind: string;
                    purchase_id?: string | null;
                    stripe_refund_id?: string | null;
                    user_id: string;
                };
                Update: {
                    amount?: number;
                    created_at?: string;
                    dive_id?: string | null;
                    granted_on?: string | null;
                    id?: string;
                    kind?: string;
                    purchase_id?: string | null;
                    stripe_refund_id?: string | null;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'log_credit_ledger_dive_id_fkey';
                        columns: ['dive_id'];
                        isOneToOne: false;
                        referencedRelation: 'dives';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'log_credit_ledger_purchase_id_fkey';
                        columns: ['purchase_id'];
                        isOneToOne: false;
                        referencedRelation: 'log_credit_purchases';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'log_credit_ledger_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            log_credit_purchases: {
                Row: {
                    amount_jpy: number;
                    created_at: string;
                    credited_at: string | null;
                    id: string;
                    quantity: number;
                    status: string;
                    stripe_checkout_session_id: string;
                    stripe_payment_intent_id: string | null;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    amount_jpy: number;
                    created_at?: string;
                    credited_at?: string | null;
                    id?: string;
                    quantity: number;
                    status?: string;
                    stripe_checkout_session_id: string;
                    stripe_payment_intent_id?: string | null;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    amount_jpy?: number;
                    created_at?: string;
                    credited_at?: string | null;
                    id?: string;
                    quantity?: number;
                    status?: string;
                    stripe_checkout_session_id?: string;
                    stripe_payment_intent_id?: string | null;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'log_credit_purchases_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            notification_preferences: {
                Row: {
                    is_enabled: boolean;
                    type: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    is_enabled: boolean;
                    type: string;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    is_enabled?: boolean;
                    type?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'notification_preferences_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            notifications: {
                Row: {
                    actor_id: string | null;
                    created_at: string;
                    dedup_key: string;
                    id: string;
                    occurred_at: string;
                    read_at: string | null;
                    recipient_id: string;
                    resource_id: string | null;
                    type: string;
                };
                Insert: {
                    actor_id?: string | null;
                    created_at?: string;
                    dedup_key?: string;
                    id?: string;
                    occurred_at?: string;
                    read_at?: string | null;
                    recipient_id: string;
                    resource_id?: string | null;
                    type: string;
                };
                Update: {
                    actor_id?: string | null;
                    created_at?: string;
                    dedup_key?: string;
                    id?: string;
                    occurred_at?: string;
                    read_at?: string | null;
                    recipient_id?: string;
                    resource_id?: string | null;
                    type?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'notifications_actor_id_fkey';
                        columns: ['actor_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'notifications_recipient_id_fkey';
                        columns: ['recipient_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            plan_packing_items: {
                Row: {
                    created_at: string;
                    id: string;
                    is_checked: boolean;
                    is_confirmed: boolean;
                    name: string;
                    plan_id: string;
                    position: number;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    is_checked?: boolean;
                    is_confirmed?: boolean;
                    name: string;
                    plan_id: string;
                    position?: number;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    is_checked?: boolean;
                    is_confirmed?: boolean;
                    name?: string;
                    plan_id?: string;
                    position?: number;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'plan_packing_items_plan_id_fkey';
                        columns: ['plan_id'];
                        isOneToOne: false;
                        referencedRelation: 'dive_plans';
                        referencedColumns: ['id'];
                    },
                ];
            };
            regulators: {
                Row: {
                    brand: string;
                    created_at: string;
                    id: string;
                    is_primary: boolean;
                    last_overhauled_on: string;
                    model: string;
                    notes: string | null;
                    overhaul_interval_dives: number;
                    overhaul_interval_months: number;
                    purchased_on: string | null;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    brand: string;
                    created_at?: string;
                    id?: string;
                    is_primary?: boolean;
                    last_overhauled_on: string;
                    model: string;
                    notes?: string | null;
                    overhaul_interval_dives?: number;
                    overhaul_interval_months?: number;
                    purchased_on?: string | null;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    brand?: string;
                    created_at?: string;
                    id?: string;
                    is_primary?: boolean;
                    last_overhauled_on?: string;
                    model?: string;
                    notes?: string | null;
                    overhaul_interval_dives?: number;
                    overhaul_interval_months?: number;
                    purchased_on?: string | null;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'regulators_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            user_details: {
                Row: {
                    birth_on: string;
                    created_at: string;
                    diver_number: string | null;
                    diver_type: string | null;
                    email_opted_in_at: string | null;
                    first_name: string;
                    first_name_romaji: string;
                    gender: string;
                    handle: string;
                    height_cm: number | null;
                    is_email_opted_in: boolean;
                    last_name: string;
                    last_name_romaji: string;
                    nickname: string;
                    terms_agreed_at: string | null;
                    terms_version: string | null;
                    updated_at: string;
                    user_id: string;
                    weight_kg: number | null;
                };
                Insert: {
                    birth_on: string;
                    created_at?: string;
                    diver_number?: string | null;
                    diver_type?: string | null;
                    email_opted_in_at?: string | null;
                    first_name: string;
                    first_name_romaji: string;
                    gender?: string;
                    handle: string;
                    height_cm?: number | null;
                    is_email_opted_in?: boolean;
                    last_name: string;
                    last_name_romaji: string;
                    nickname: string;
                    terms_agreed_at?: string | null;
                    terms_version?: string | null;
                    updated_at?: string;
                    user_id: string;
                    weight_kg?: number | null;
                };
                Update: {
                    birth_on?: string;
                    created_at?: string;
                    diver_number?: string | null;
                    diver_type?: string | null;
                    email_opted_in_at?: string | null;
                    first_name?: string;
                    first_name_romaji?: string;
                    gender?: string;
                    handle?: string;
                    height_cm?: number | null;
                    is_email_opted_in?: boolean;
                    last_name?: string;
                    last_name_romaji?: string;
                    nickname?: string;
                    terms_agreed_at?: string | null;
                    terms_version?: string | null;
                    updated_at?: string;
                    user_id?: string;
                    weight_kg?: number | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'user_details_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: true;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            user_follows: {
                Row: {
                    created_at: string;
                    followee_id: string;
                    follower_id: string;
                };
                Insert: {
                    created_at?: string;
                    followee_id: string;
                    follower_id: string;
                };
                Update: {
                    created_at?: string;
                    followee_id?: string;
                    follower_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'user_follows_followee_id_fkey';
                        columns: ['followee_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'user_follows_follower_id_fkey';
                        columns: ['follower_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            users: {
                Row: {
                    created_at: string;
                    id: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    id: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            apply_credit_ledger_entry: {
                Args: {
                    p_amount: number;
                    p_dive_id?: string;
                    p_granted_on?: string;
                    p_kind: string;
                    p_purchase_id?: string;
                    p_stripe_refund_id?: string;
                    p_user_id: string;
                };
                Returns: string;
            };
            apply_refund: {
                Args: { p_payment_intent_id: string; p_refund_id: string };
                Returns: boolean;
            };
            complete_purchase: {
                Args: {
                    p_amount_jpy: number;
                    p_payment_intent_id: string;
                    p_quantity: number;
                    p_session_id: string;
                    p_user_id: string;
                };
                Returns: boolean;
            };
            create_pending_purchase: {
                Args: { p_amount_jpy: number; p_quantity: number; p_session_id: string };
                Returns: string;
            };
            discard_recent_inquiry: { Args: { p_email: string; p_id: string }; Returns: undefined };
            get_dive_monthly_stats: {
                Args: { months_back?: number };
                Returns: {
                    dive_count: number;
                    month: string;
                }[];
            };
            get_dive_stats: {
                Args: never;
                Returns: {
                    max_depth_m: number;
                    total_bottom_time_min: number;
                    total_dives: number;
                    visited_locations: number;
                }[];
            };
            get_dive_yearly_counts: {
                Args: never;
                Returns: {
                    dive_count: number;
                    year: number;
                }[];
            };
            get_user_id_by_handle: { Args: { p_handle: string }; Returns: string };
            get_user_public_profiles: {
                Args: { p_ids: string[] };
                Returns: {
                    handle: string;
                    nickname: string;
                    user_id: string;
                }[];
            };
            grant_daily_bonus: { Args: never; Returns: boolean };
            is_admin: { Args: never; Returns: boolean };
            is_handle_taken: {
                Args: { p_exclude_user_id?: string; p_handle: string };
                Returns: boolean;
            };
            is_nickname_taken: {
                Args: { p_exclude_user_id?: string; p_nickname: string };
                Returns: boolean;
            };
            is_public_dive_photo: { Args: { object_name: string }; Returns: boolean };
            is_superadmin: { Args: never; Returns: boolean };
            search_users_by_handle: {
                Args: { p_limit?: number; p_query: string };
                Returns: {
                    handle: string;
                    nickname: string;
                    user_id: string;
                }[];
            };
            submit_inquiry: {
                Args: {
                    p_body: string;
                    p_category: string;
                    p_email: string;
                    p_name: string;
                    p_submitter_ip: unknown;
                    p_submitter_user_id: string;
                };
                Returns: string;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
          Row: infer R;
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
      ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R;
        }
          ? R
          : never
      : never;

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Insert: infer I;
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I;
        }
          ? I
          : never
      : never;

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Update: infer U;
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U;
        }
          ? U
          : never
      : never;

export type Enums<
    DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
      ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema['CompositeTypes']
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
        : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
      ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
      : never;

export const Constants = {
    graphql_public: {
        Enums: {},
    },
    public: {
        Enums: {},
    },
} as const;
