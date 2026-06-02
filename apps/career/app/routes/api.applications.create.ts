import type { ActionFunction } from 'react-router'
import { createClient } from '~/lib/supabase/server'
import type { JobPosting } from '~/types/applications'

export const action: ActionFunction = async ({ request }) => {
  try {
    const { supabase } = createClient(request)

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json()
    const { jobPosting } = body as { jobPosting: JobPosting }

    if (!jobPosting) {
      return new Response(JSON.stringify({ error: 'Job posting data is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // First, create or find the company
    let companyId: string

    // Check if company already exists
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('name', jobPosting.companyName)
      .single()

    if (existingCompany) {
      companyId = existingCompany.id
    } else {
      // Create new company
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: jobPosting.companyName,
          website: jobPosting.url ? new URL(jobPosting.url).origin : null,
          description: jobPosting.companyDescription || null,
        })
        .select('id')
        .single()

      if (companyError) {
        console.error('Error creating company:', companyError)
        return new Response(
          JSON.stringify({
            error: 'Failed to create company',
            success: false,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }

      companyId = newCompany.id
    }

    // Save the job posting as an application
    const { data: application, error: insertError } = await supabase
      .from('job_applications')
      .insert({
        user_id: user.id,
        company_id: companyId,
        position: jobPosting.jobTitle,
        status: 'APPLIED',
        start_date: new Date().toISOString(),
        job_posting: JSON.stringify(jobPosting),
        location: jobPosting.location || null,
        source: 'scraped',
        application_date: new Date().toISOString(),
        link: jobPosting.url || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error saving application:', insertError)
      return new Response(
        JSON.stringify({
          error: 'Failed to save application',
          success: false,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        application,
        message: 'Application saved successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Application creation error:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
