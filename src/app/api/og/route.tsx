import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

import { siteConfig } from '@/lib/config';

export const runtime = 'edge';

// Define the size constants
const WIDTH = 1200;
const HEIGHT = 630;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Get title from search params or use description as default instead of name
    const title = searchParams.get('title') || siteConfig.description;
    // Get gradient colors or use defaults
    const gradientFrom = searchParams.get('from') || '0062F0';
    const gradientTo = searchParams.get('to') || '091E3B';

    // Use the existing favicon.svg as the logo
    const logoUrl = new URL('../../../../public/favicon.svg', import.meta.url);
    const logo = await fetch(logoUrl).then((res) => res.text());

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            backgroundImage: `linear-gradient(135deg, #${gradientFrom}, #${gradientTo})`,
            position: 'relative'
          }}
        >
          {/* Main content box */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              padding: '32px 50px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
              color: '#111827',
              margin: '0 20px',
              width: '90%',
              maxWidth: '1000px',
              overflowWrap: 'break-word',
              wordWrap: 'break-word'
            }}
          >
            <div
              style={{
                fontSize: title.length > 40 ? 48 : 64,
                fontWeight: 700,
                lineHeight: 1.2,
                maxWidth: '100%',
                wordBreak: 'break-word',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
              }}
            >
              {title}
            </div>
          </div>

          {/* Logo and brand at the bottom */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '14px 26px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 2px 15px rgba(0, 0, 0, 0.1)',
              gap: '16px',
              position: 'absolute',
              bottom: '30px'
            }}
          >
            <img
              src={`data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}`}
              width="50"
              height="50"
              alt="AgentDock Logo"
            />
            <div
              style={{
                fontSize: 40,
                fontWeight: 900,
                color: '#000',
                letterSpacing: '-0.02em',
                textShadow: '0 0 1px #000',
                WebkitTextStroke: '0.5px black'
              }}
            >
              AgentDock Hub
            </div>
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT
      }
    );
  } catch (error) {
    console.error('Error generating OG image:', error);
    return new Response(
      `Failed to generate OG image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 500 }
    );
  }
}
