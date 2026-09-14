import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const allowedUserTypes = new Set(['Master', 'Manager', 'Viewer', 'Onboarding']);

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get('Authorization');
    const accessToken = authorization?.replace(/^Bearer\s+/i, '').trim();

    if (!accessToken) {
      return jsonResponse({ success: false, error: 'Authentication required' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase function environment variables');
      return jsonResponse({ success: false, error: 'Server configuration error' }, 500);
    }

    // The service-role client is only used after independently validating the
    // caller and confirming their active Master profile.
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: callerAuth, error: callerAuthError } = await supabaseAdmin.auth.getUser(accessToken);
    if (callerAuthError || !callerAuth.user) {
      return jsonResponse({ success: false, error: 'Invalid or expired session' }, 401);
    }

    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from('users')
      .select('user_type, is_active')
      .eq('id', callerAuth.user.id)
      .maybeSingle();

    if (callerProfileError) {
      console.error('Failed to verify caller profile', callerProfileError);
      return jsonResponse({ success: false, error: 'Unable to verify permissions' }, 500);
    }

    if (!callerProfile?.is_active || callerProfile.user_type !== 'Master') {
      return jsonResponse({ success: false, error: 'Master access required' }, 403);
    }

    // Parse request body
    const { username, email, password, userType } = await req.json();

    // Validate required fields
    if (!username || !email || !password) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: username, email, and password are required' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    if (userType && !allowedUserTypes.has(userType)) {
      return jsonResponse({ success: false, error: 'Invalid user type' }, 400);
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUsers) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'User already exists',
          userId: existingUsers.id 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Check if auth user exists
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingAuthUser) {
      userId = existingAuthUser.id;
    } else {
      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: authError?.message || 'Failed to create auth user' 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }

      userId = authData.user.id;
    }

    // Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        username: username,
        user_type: userType || 'Viewer', // Default to Viewer if not specified
        is_active: true,
      });

    if (profileError) {
      // If profile creation fails but auth user was just created, clean up
      if (!existingAuthUser) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: profileError.message || 'Failed to create user profile' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User created successfully',
        userId: userId,
        username: username,
        email: email
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
