// emails/InviteEmail.tsx
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Img,
  Section,
  Row,
  Column,
} from '@react-email/components';

interface InviteEmailProps {
  eventTitle: string;
  eventDate: string;
  eventPlace: string;
  acceptUrl: string;
  rejectUrl: string;
  regDeadline?: string;
  message?: string;
}

export default function InviteEmail({
  eventTitle,
  eventDate,
  eventPlace,
  acceptUrl,
  rejectUrl,
  regDeadline,
  message,
}: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ background: '#f4f4f4', padding: '40px 0' }}>
        <Container
          style={{
            maxWidth: '500px',
            margin: '0 auto',
            background: '#ffffff',
            padding: '20px',
            border: '1px solid #e0e0e0',
          }}
        >
          {/* Gold Border Wrapper */}
          <Section
            style={{
              border: '3px double #d4af37',
              padding: '40px 20px',
              textAlign: 'center' as const,
            }}
          >
            {/* Crown Icon - Updated to a more reliable URL */}
            <Img
              src="https://img.icons8.com/puffy/80/d4af37/crown.png"
              width="60"
              height="60"
              alt="Crown"
              style={{ margin: '0 auto 20px', display: 'block' }}
            />

            <Heading
              style={{
                color: '#1a1a1a',
                fontSize: '28px',
                fontWeight: 'normal',
                textTransform: 'uppercase' as const,
                letterSpacing: '4px',
                margin: '0 0 10px',
              }}
            >
              Invitation
            </Heading>

            <Text
              style={{
                color: '#555',
                fontStyle: 'italic',
                fontSize: '16px',
                margin: '0 0 20px',
              }}
            >
              We are delighted to welcome you
            </Text>

            <Text
              style={{
                color: '#333',
                fontSize: '15px',
                lineHeight: '1.6',
                margin: '0 0 25px',
              }}
            >
              You are cordially invited to attend
              <br />
              our exclusive special event.
            </Text>

            {/* Event Title */}
            <Text
              style={{
                color: '#4b2a85',
                fontSize: '22px',
                fontWeight: 'bold',
                margin: '0 0 25px',
              }}
            >
              {eventTitle}
            </Text>
            {/* PERSONAL MESSAGE */}
            {message && (
              <Section
                style={{
                  background: '#faf7ef',
                  border: '1px solid #e8dcc2',
                  padding: '18px',
                  margin: '0 0 30px',
                  textAlign: 'left',
                }}
              >
                <Text
                  style={{
                    color: '#d4af37',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    margin: '0 0 10px',
                  }}
                >
                  Personal Message
                </Text>

                <Text
                  style={{
                    color: '#444',
                    fontSize: '14px',
                    lineHeight: '1.8',
                    margin: 0,
                    fontStyle: 'italic',
                  }}
                >
                  "{message}"
                </Text>
              </Section>
            )}
            {/* Details */}
            <Section
              style={{
                marginBottom: '30px',
                textAlign: 'left' as const,
                padding: '0 20px',
              }}
            >
              <Text
                style={{ margin: '8px 0', fontSize: '14px', color: '#444' }}
              >
                <strong style={{ color: '#d4af37' }}>Time:</strong> {eventDate}
              </Text>
              <Text
                style={{ margin: '8px 0', fontSize: '14px', color: '#444' }}
              >
                <strong style={{ color: '#d4af37' }}>Location:</strong>{' '}
                {eventPlace}
              </Text>
              <Text
                style={{ margin: '8px 0', fontSize: '14px', color: '#444' }}
              >
                <strong style={{ color: '#d4af37' }}>Deadline:</strong>{' '}
                {regDeadline}
              </Text>
            </Section>

            {/* Buttons */}
            <Row
              style={{
                width: '100%',
                maxWidth: '350px',
                margin: '0 auto 40px',
              }}
            >
              <Column style={{ paddingRight: '10px' }}>
                <Button
                  href={acceptUrl}
                  style={{
                    background: '#4b2a85',
                    color: '#fff !important',
                    padding: '12px 0',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    width: '100%',
                    textAlign: 'center' as const,
                    display: 'block',
                    textDecoration: 'none',
                    WebkitTextFillColor: '#ffffff',
                  }}
                >
                  ACCEPT
                </Button>
              </Column>
              <Column style={{ paddingLeft: '10px' }}>
                <Button
                  href={rejectUrl}
                  style={{
                    background: 'transparent',
                    color: '#4b2a85 !important',
                    padding: '10px 0',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    border: '2px solid #4b2a85',
                    width: '100%',
                    textAlign: 'center' as const,
                    display: 'block',
                    WebkitTextFillColor: '#4b2a85',
                    textDecoration: 'none',
                  }}
                >
                  DECLINE
                </Button>
              </Column>
            </Row>

            <Text
              style={{
                color: '#999',
                fontSize: '11px',
                lineHeight: '1.5',
                padding: '0 20px',
              }}
            >
              This is an automated invitation. Please RSVP by the deadline to
              help us prepare the best experience for you.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
