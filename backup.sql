--
-- PostgreSQL database dump
--

\restrict O4zLQy8lAKqYqRqLkzdyFEROTDabmQxpS2H0k5jwAiLrsO8MENwJctEY2B7UasA

-- Dumped from database version 15.17 (Debian 15.17-1.pgdg13+1)
-- Dumped by pg_dump version 15.17 (Debian 15.17-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: events_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.events_status_enum AS ENUM (
    'draft',
    'published',
    'upcoming',
    'ongoing',
    'ended',
    'cancelled',
    'postponed'
);


ALTER TYPE public.events_status_enum OWNER TO postgres;

--
-- Name: invites_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.invites_status_enum AS ENUM (
    'pending',
    'accepted',
    'rejected'
);


ALTER TYPE public.invites_status_enum OWNER TO postgres;

--
-- Name: org_verifications_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.org_verifications_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public.org_verifications_status_enum OWNER TO postgres;

--
-- Name: organizations_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.organizations_status_enum AS ENUM (
    'PENDING',
    'REJECTED',
    'ACTIVE',
    'ARCHIVED',
    'SUSPENDED'
);


ALTER TYPE public.organizations_status_enum OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    description character varying NOT NULL,
    place character varying NOT NULL,
    "startDateTime" timestamp without time zone NOT NULL,
    "endDateTime" timestamp without time zone NOT NULL,
    "registrationEndDate" timestamp without time zone NOT NULL,
    capacity integer NOT NULL,
    "isPublic" boolean DEFAULT false NOT NULL,
    title character varying NOT NULL,
    "organizationId" uuid,
    status public.events_status_enum NOT NULL,
    "eventPoster" character varying
);


ALTER TABLE public.events OWNER TO postgres;

--
-- Name: feedbacks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feedbacks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    rating integer NOT NULL,
    comment character varying,
    "userId" uuid,
    "eventId" uuid
);


ALTER TABLE public.feedbacks OWNER TO postgres;

--
-- Name: invites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invites (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "emailInvite" character varying NOT NULL,
    "eventId" uuid,
    token character varying NOT NULL,
    message character varying,
    status public.invites_status_enum DEFAULT 'pending'::public.invites_status_enum NOT NULL
);


ALTER TABLE public.invites OWNER TO postgres;

--
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    name character varying NOT NULL,
    price integer NOT NULL,
    "ticketId" uuid
);


ALTER TABLE public.items OWNER TO postgres;

--
-- Name: membership_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.membership_roles (
    "membershipsId" uuid NOT NULL,
    "rolesId" uuid NOT NULL
);


ALTER TABLE public.membership_roles OWNER TO postgres;

--
-- Name: memberships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.memberships (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "userId" uuid,
    "organizationId" uuid,
    "roleId" uuid
);


ALTER TABLE public.memberships OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "totalPrice" integer NOT NULL,
    "userId" uuid
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: org_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_verifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "taxIdNumber" character varying,
    "documentUrl" character varying,
    status public.org_verifications_status_enum DEFAULT 'PENDING'::public.org_verifications_status_enum NOT NULL,
    "adminNote" character varying,
    "verifiedAt" timestamp without time zone,
    "requesterId" uuid,
    "verifiedById" uuid
);


ALTER TABLE public.org_verifications OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    name character varying NOT NULL,
    bio character varying,
    "isActive" boolean DEFAULT true NOT NULL,
    "ownerId" uuid,
    slug character varying,
    status public.organizations_status_enum DEFAULT 'PENDING'::public.organizations_status_enum NOT NULL,
    "logoUrl" character varying,
    "bannerUrl" character varying,
    industry character varying NOT NULL,
    email character varying,
    phone character varying,
    website character varying,
    address character varying,
    "isVerified" boolean DEFAULT false NOT NULL,
    "verifiedAt" timestamp without time zone,
    "legalName" character varying
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    permission_code character varying NOT NULL,
    permission_name character varying NOT NULL,
    parent_id uuid
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    reason character varying NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    "userId" uuid,
    "organizationId" uuid
);


ALTER TABLE public.reports OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    "rolesId" uuid NOT NULL,
    "permissionsId" uuid NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid,
    "colorKey" character varying,
    role_name character varying NOT NULL,
    role_code character varying NOT NULL,
    "deletedAt" timestamp without time zone
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: ticketTypes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ticketTypes" (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    name character varying NOT NULL,
    price integer NOT NULL,
    quantity integer NOT NULL,
    "eventId" uuid,
    "orderId" uuid
);


ALTER TABLE public."ticketTypes" OWNER TO postgres;

--
-- Name: tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tickets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "ticketTypeId" uuid
);


ALTER TABLE public.tickets OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    email character varying NOT NULL,
    password character varying NOT NULL,
    "fullName" character varying NOT NULL,
    "phoneNumber" character varying,
    "isActive" boolean DEFAULT true NOT NULL,
    "refreshToken" character varying,
    is_delete boolean DEFAULT false NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.events (id, "createdAt", "updatedAt", description, place, "startDateTime", "endDateTime", "registrationEndDate", capacity, "isPublic", title, "organizationId", status, "eventPoster") FROM stdin;
eba358fa-2aac-4f70-8e8d-bea468fe8cce	2026-04-12 14:46:30.184035	2026-04-12 14:46:30.184035	tôi test dashboard	tay ninh	2001-12-08 00:00:00	2013-12-02 00:00:00	2014-12-03 00:00:00	120	t	sự kiên 	b38fdd70-b0fa-4f3f-926d-33b7809ff325	upcoming	https://res.cloudinary.com/dt3crglba/image/upload/v1777709209/mfd5vwah40h26shaapto.jpg
e1111111-1111-4111-a111-111111111111	2026-05-02 12:52:37.063465	2026-05-04 13:49:41.53501	Học cách xây dựng hệ thống scale lớn với NestJS.	Quận 1, TP.HCM	2026-07-15 08:00:00	2026-07-15 17:00:00	2026-07-01 00:00:00	200	t	Workshop NestJS & Microservices	b38fdd70-b0fa-4f3f-926d-33b7809ff325	cancelled	https://res.cloudinary.com/dt3crglba/image/upload/v1777902580/poster/j4o6dqecdprieisj5ant.png
e5555555-5555-4555-a555-555555555555	2026-05-02 12:52:37.063465	2026-05-07 12:22:40.633943	Cuộc họp chiến lược quý 2 dành riêng cho nhân viên.	Văn Phòng Công Ty Asia Dragon Group Đường Hồ Tùng Mậu Phường Bến Nghé,Quận 1,Thành Phố Hồ Chí Minh	2026-06-01 09:00:00	2026-06-01 11:00:00	2026-05-30 00:00:00	20	f	Meeting Nội bộ Organization	b38fdd70-b0fa-4f3f-926d-33b7809ff325	upcoming	https://res.cloudinary.com/dt3crglba/image/upload/v1777902908/poster/pgqyacziq2yiojyka8io.png
2fcab685-81c0-45ff-b138-a356ae6f9637	2026-05-03 13:19:42.673417	2026-05-08 04:50:05.096246	Chào mừng bạn đến với **The Odyssey Book Fair 2026** – hành trình khám phá tri thức và văn hóa đọc lớn nhất trong năm!\n\nSự kiện năm nay không chỉ là nơi mua sắm sách, mà còn là không gian trải nghiệm nghệ thuật và công nghệ xuất bản hiện đại:\n\n*   **Giao lưu Tác giả:** Cơ hội gặp gỡ, đặt câu hỏi và ký tặng sách cùng các tác giả Best-seller trong và ngoài nước.\n*   **Khu vực Digital Reading:** Trải nghiệm đọc sách thực tế ảo (VR) và các thiết bị đọc sách điện tử thế hệ mới nhất.\n*   **Indie Publishers' Corner:** Nơi trưng bày các ấn phẩm độc bản và sách nghệ thuật (Artbooks) từ các nhà xuất bản độc lập.\n*   **Workshop Sáng tác:** Tham gia các lớp học ngắn hạn về viết lách, minh họa và thiết kế bìa sách cùng các chuyên gia.\n\n**Lưu ý:** Vì không gian tổ chức có hạn (**Capacity: 1200**), chúng tôi sẽ đóng cổng đăng ký ngay khi số lượng vé được phát hành hết. Hãy chọn hạng vé phù hợp để nhận được các phần quà giới hạn từ ban tổ chức!	Sân Banh Vạn Phúc Phường Hiệp Bình Phước,Thành Phố Thủ Đức,Thành Phố Hồ Chí Minh	2026-05-01 05:00:00	2026-05-22 05:00:00	2026-05-01 05:00:00	10	f	The Odyssey Book Fair 2026: Beyond the Pages	b46ed74d-4a79-40a7-a2a1-723be34d951b	cancelled	https://res.cloudinary.com/dt3crglba/image/upload/v1777902524/poster/amnvuztnj21lt8hau3zs.png
e4444444-4444-4444-a444-444444444444	2026-05-02 12:52:37.063465	2026-05-04 13:50:26.563863	Sự kiện bị hủy do điều kiện thời tiết không cho phép.	Công viên 30/4	2026-05-20 14:00:00	2026-05-20 17:00:00	2026-05-15 00:00:00	50	f	Offline Community IT Tây Ninh	b38fdd70-b0fa-4f3f-926d-33b7809ff325	cancelled	https://res.cloudinary.com/dt3crglba/image/upload/v1777902626/poster/zoiluhtswtavqfbnhxnr.png
e3333333-3333-4333-a333-333333333333	2026-05-02 12:52:37.063465	2026-05-10 11:54:43.869145	Tìm hiểu sâu về Next.js App Router và RSC.	Online (Google Meet)	2026-04-10 19:00:00	2026-04-10 21:00:00	2026-04-09 00:00:00	500	t	Seminar React Server Components	b38fdd70-b0fa-4f3f-926d-33b7809ff325	ended	https://res.cloudinary.com/dt3crglba/image/upload/v1777902638/poster/p6pnwjd0ceoywjdxgraz.png
e2222222-2222-4222-a222-222222222222	2026-05-02 12:52:37.063465	2026-05-04 13:54:33.829243	Cuộc thi lập trình ứng dụng di động trong 24h.	Tây Ninh	2026-05-01 08:00:00	2026-05-02 13:00:00	2026-04-25 00:00:00	100	t	Hackathon Mobile App 2026	b38fdd70-b0fa-4f3f-926d-33b7809ff325	ongoing	https://res.cloudinary.com/dt3crglba/image/upload/v1777902873/poster/pf6hsbyjtek60kwywslk.png
47357465-959f-4610-8d31-4a98cfa5167a	2026-05-03 08:47:35.827512	2026-05-04 13:48:59.887997	123	123	2026-05-03 05:00:00	2026-05-03 05:00:00	2026-05-02 05:00:00	110	f	123	12809cb8-049f-4dc9-b6a7-54c00b898108	cancelled	https://res.cloudinary.com/dt3crglba/image/upload/v1777902539/poster/heb2zzpbedjjgodh5qmx.png
51ea8049-3c79-478e-824d-5a8c4fdc35ac	2026-05-03 08:47:35.756256	2026-05-04 13:49:16.50778	123	123	2026-05-03 05:00:00	2026-05-03 05:00:00	2026-05-02 05:00:00	110	f	123	12809cb8-049f-4dc9-b6a7-54c00b898108	cancelled	https://res.cloudinary.com/dt3crglba/image/upload/v1777902555/poster/n4ejfsa6zchflxyxtj1e.png
331f68b0-d63f-4485-badc-0a737e657835	2026-04-12 15:08:54.409405	2026-05-05 09:12:30.257528	tôi test dashboard	tay ninh	2001-12-08 00:00:00	2001-12-08 00:00:00	2001-12-08 00:00:00	130	t	sự kiên 2	b38fdd70-b0fa-4f3f-926d-33b7809ff325	ongoing	https://res.cloudinary.com/dt3crglba/image/upload/v1777972349/poster/vuyigkjjl7cuemj8x565.png
49602c1d-2270-4562-97f4-36d5d77e97bf	2026-05-03 08:40:27.10366	2026-05-06 07:53:29.006975	chơi \nchơi\nchơi\nchơi	tây ninh	2026-05-14 05:00:00	2026-05-14 05:00:00	2026-05-13 05:00:00	100	f	Event Google VietNam	b38fdd70-b0fa-4f3f-926d-33b7809ff325	cancelled	https://res.cloudinary.com/dt3crglba/image/upload/v1777902567/poster/fzzp4spostu7z0esmwu7.png
75ed6480-a889-4d01-98ce-4cc2b9311a65	2026-05-03 13:19:42.714199	2026-05-07 06:53:22.001007	Experience the fusion of sound, light, and energy!\n          Chào mừng bạn đến với Vibrance Sound Fest 2026 – sự kiện âm nhạc điện tử và nghệ thuật trình diễn lớn nhất trong năm. Với sự góp mặt của dàn Line-up nghệ sĩ quốc tế và hệ thống âm thanh tiêu chuẩn thế giới, chúng tôi hứa hẹn mang đến một đêm không ngủ cho tất cả tín đồ âm nhạc.\nHighlights của sự kiện:\n         Hệ thống âm thanh L-Acoustics: Trải nghiệm chất lượng âm thanh trung thực đến từng nhịp bass.\n          Sân khấu 360 độ: Thiết kế hiện đại giúp mọi vị trí trong hội trường đều là "điểm ngọt" của âm nhạc.\nVisual Art: Sự kết hợp giữa Mapping 3D và công nghệ Laser tân tiến nhất.\nLưu ý về vé:\n       Hệ thống có giới hạn sức chứa (Capacity) nghiêm ngặt để đảm bảo an toàn và trải nghiệm tốt nhất.\n       Các loại vé VIP và Early Bird luôn hết sớm (Sold Out) do số lượng phát hành hạn chế.	Hệ Thống Bò Tơ Tây Ninh 160 Đường Đặng Nguyên Cẩn,Phường 13,Quận 6,Thành Phố Hồ Chí Minh	2026-05-01 05:00:00	2026-05-22 05:00:00	2026-05-01 05:00:00	110	f	The central Part	12809cb8-049f-4dc9-b6a7-54c00b898108	cancelled	https://res.cloudinary.com/dt3crglba/image/upload/v1777902508/poster/zhaveyby0xygb0xctm8o.png
\.


--
-- Data for Name: feedbacks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.feedbacks (id, "createdAt", "updatedAt", rating, comment, "userId", "eventId") FROM stdin;
\.


--
-- Data for Name: invites; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invites (id, "createdAt", "updatedAt", "emailInvite", "eventId", token, message, status) FROM stdin;
c0151d49-6018-4d8e-8ef9-f3b5fb65e0b3	2026-05-12 06:43:27.185993	2026-05-12 06:43:27.185993	baumgaerho.ope.r283.2@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	ffc436e1-41ba-4ebc-b37f-518c021777ea	\N	pending
18088061-0b10-4491-8645-e37018561e42	2026-05-12 06:43:27.185993	2026-05-12 06:43:27.185993	jillfrankl.in.17.1.40@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	3764326e-12b7-4f98-8f44-46e8006e18b4	\N	pending
d53fe651-2611-4647-8376-d189d26fc0dd	2026-05-12 06:43:27.185993	2026-05-12 06:43:27.185993	nangtiechpa.n.g.gh.ynh@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	7d60a0c6-de27-4e16-a6a2-79819a53ae93	\N	pending
8a18d627-2e81-4693-a981-302c4a3112f8	2026-05-12 07:01:50.283077	2026-05-12 07:01:50.283077	jillfrank.li.n.1.7.1.40@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	6852b026-aed9-4fc7-94b4-de2b056993bd	\N	pending
0b0b0dc9-86f1-4b8d-813e-bdfd90fff542	2026-05-12 07:04:56.25593	2026-05-12 07:04:56.25593	chauhantmkr.is.hn.ao.3@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	3cf96eea-22ff-47dd-9fce-4c6066359950	\N	pending
831bcf51-8907-4dc3-b698-a3c5ff3c4792	2026-05-12 07:06:51.3362	2026-05-12 07:06:51.3362	jennysil.va3.23.1.2@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	f8668e62-fa49-4dab-971c-b5a354d1ef89	\N	pending
d7865057-2422-4390-826f-d63bb53d7d4f	2026-05-24 11:47:09.890899	2026-05-24 11:47:27.826229	livingston.frost3.14@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	27564ce6-0654-4798-b497-35acde8b9ca8	test4	rejected
af3a3e4f-10f9-47f7-b4ca-3df37f24d289	2026-05-09 06:38:25.8553	2026-05-09 06:52:01.535916	buitaia9@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	a498ff6f-de15-432d-8b23-7bf3071af699	\N	pending
71117130-234f-4522-a09c-6e7a92727c68	2026-05-12 08:58:17.213268	2026-05-12 08:58:17.213	earlbrook.s41.4.41@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	03b5d57e-300c-4b6a-b7ef-53474c666669	\N	pending
f62225e3-c268-419e-af79-089d55938a27	2026-05-12 11:35:53.69871	2026-05-12 11:51:14.491442	thoamla.m.buo.c@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	69424ebe-fd4f-4b6f-8c59-7a97b055c6e3	\N	pending
35a17f4f-1c23-432b-99ba-edd915b1541e	2026-05-12 11:37:24.379479	2026-05-12 12:47:33.147653	brianwilmr1.4.1.9.8.9@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	0548ad01-60c4-4426-b6ee-0e4e8c1247ff	\N	accepted
6279eb4a-8110-4d80-8702-ee808ce59109	2026-05-24 11:32:41.556175	2026-05-24 11:32:41.556175	giecphangqu.anh.g.hu.ng@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	d31b6ad0-c7b3-49e1-b90c-530e7b64afa2	test 1	pending
5a1cc1cf-9a6e-4646-965a-dfcb5694c812	2026-05-24 11:33:07.740277	2026-05-24 11:33:34.714232	xanhpeog.o.e.t.g.a.ch@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	e87de85e-0316-481d-8a2a-5201df862a29	test1	accepted
b177502d-7657-45f4-b43a-9827a8de2286	2026-05-24 11:40:17.309383	2026-05-24 11:40:31.360611	suynh.kh.ept.hat@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	521866f7-b6a6-404f-bdc8-f0baeb82db67	test2	accepted
55152fba-8126-42ca-973c-7afee1c87926	2026-05-24 11:43:26.225578	2026-05-24 11:44:23.81971	craigjames6.5544@gmail.com	75ed6480-a889-4d01-98ce-4cc2b9311a65	990a93c5-3565-4c96-a602-05de04b5e5b4	test3	accepted
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.items (id, "createdAt", "updatedAt", name, price, "ticketId") FROM stdin;
\.


--
-- Data for Name: membership_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.membership_roles ("membershipsId", "rolesId") FROM stdin;
\.


--
-- Data for Name: memberships; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.memberships (id, "createdAt", "updatedAt", "isActive", "userId", "organizationId", "roleId") FROM stdin;
b3ca5abf-22c6-4405-bc2f-535d4d77e12f	2026-04-20 06:07:24.513857	2026-04-20 06:07:24.513857	t	c6a3f782-1142-4288-b81d-a02aa0c0dee3	b46ed74d-4a79-40a7-a2a1-723be34d951b	ae002b0f-3e8d-4373-83cd-e5584aebd973
008d6fb2-d742-4885-ba1b-647dfe757c7e	2026-04-20 06:07:58.668939	2026-04-20 06:07:58.668939	t	01bc3d28-acdf-4ef1-86a9-3356b8fda140	b46ed74d-4a79-40a7-a2a1-723be34d951b	ae002b0f-3e8d-4373-83cd-e5584aebd973
54b75aaf-1718-4a9d-8166-e4110d73ce5a	2026-04-24 11:23:09.596623	2026-04-24 11:23:09.596623	t	54666d85-c528-4bfd-b3f0-f87d803be0f4	b38fdd70-b0fa-4f3f-926d-33b7809ff325	2db3ecec-ff64-488c-ad99-3fd8b6091406
580adc3a-ad42-4bf8-8285-f9d01d5a869c	2026-04-24 11:23:09.596623	2026-04-24 11:23:09.596623	t	54666d85-c528-4bfd-b3f0-f87d803be0f4	dbcc3d57-9fc7-4e36-b283-76e4e6cc32a6	c38c32ba-8073-40f4-9a35-af1f5817f4c4
c1f97486-67c7-48dd-9dca-4ae1fa756cd5	2026-04-24 11:23:09.596623	2026-04-24 11:23:09.596623	t	54666d85-c528-4bfd-b3f0-f87d803be0f4	b46ed74d-4a79-40a7-a2a1-723be34d951b	6892c73d-b382-4633-8e23-59b4e7997f75
c7fe70b0-1fe7-4ba1-9155-dec904d4067f	2026-04-24 11:24:31.60202	2026-04-24 11:24:31.60202	t	8f0b03c3-49f8-457d-8828-ed6bcbadf23e	b38fdd70-b0fa-4f3f-926d-33b7809ff325	73b7dba5-f19d-4682-b71d-77fcf6674352
f2465a98-6ab4-48eb-823a-c79c7ddcba4d	2026-04-27 05:05:13.929159	2026-04-27 05:05:13.929159	t	18d91b19-c519-4d5c-bebd-176f5538baa2	b38fdd70-b0fa-4f3f-926d-33b7809ff325	2db3ecec-ff64-488c-ad99-3fd8b6091406
1d614612-69e2-4573-ad83-4bfcc1e9c3de	2026-04-27 05:05:25.339279	2026-04-27 05:05:25.339279	t	321c3b2f-da85-4ffa-b063-1d6e8b606ee8	b38fdd70-b0fa-4f3f-926d-33b7809ff325	73b7dba5-f19d-4682-b71d-77fcf6674352
02e4cf0b-39eb-4d4d-a15f-97decf4b070b	2026-04-27 06:13:44.845142	2026-04-27 06:13:44.845142	t	08276f30-26e7-469b-8e73-91240ec18542	e951c81b-7e94-49ec-a969-666dd0d127e8	9204ae74-42ca-4648-848a-4c3f34decf50
4ee1f2aa-b995-48f5-a7c8-995a9cc17c0c	2026-04-28 06:20:29.60499	2026-04-28 06:20:29.60499	t	c7743f2a-8392-4799-99c0-37e067d19257	b46ed74d-4a79-40a7-a2a1-723be34d951b	ae002b0f-3e8d-4373-83cd-e5584aebd973
f7babc56-3164-4b34-a02a-0b135a50ee7c	2026-05-25 04:38:28.906066	2026-05-25 04:38:28.906066	t	4f78f0ea-9f0c-4ab2-8fa7-71f0172e3a74	12809cb8-049f-4dc9-b6a7-54c00b898108	6a8dafd4-22f6-4d83-b649-57b4a45ee632
574c74b0-96cf-4053-a362-358095d544b0	2026-05-25 04:38:28.906066	2026-05-25 04:38:28.906066	t	4f78f0ea-9f0c-4ab2-8fa7-71f0172e3a74	dbcc3d57-9fc7-4e36-b283-76e4e6cc32a6	f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, "createdAt", "updatedAt", "totalPrice", "userId") FROM stdin;
\.


--
-- Data for Name: org_verifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_verifications (id, "createdAt", "updatedAt", "organizationId", "taxIdNumber", "documentUrl", status, "adminNote", "verifiedAt", "requesterId", "verifiedById") FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, "createdAt", "updatedAt", name, bio, "isActive", "ownerId", slug, status, "logoUrl", "bannerUrl", industry, email, phone, website, address, "isVerified", "verifiedAt", "legalName") FROM stdin;
12809cb8-049f-4dc9-b6a7-54c00b898108	2026-04-29 07:47:26.494315	2026-05-04 13:19:34.019373	Google Vietnam	Leading technology company in Southeast Asia	t	18d91b19-c519-4d5c-bebd-176f5538baa2	google-vietnam	PENDING	\N	\N	Technology	contact@google.com.vn	+84901234567	https://google.com.vn	123 District 1, Ho Chi Minh City, Vietnam	f	\N	Google Vietnam Company Limited
dbcc3d57-9fc7-4e36-b283-76e4e6cc32a6	2026-04-18 09:17:01.281853	2026-05-04 13:19:34.743187	Cty 666	string	t	54666d85-c528-4bfd-b3f0-f87d803be0f4	cty-666	ARCHIVED	\N	\N	1	\N	\N	\N	\N	f	\N	\N
e951c81b-7e94-49ec-a969-666dd0d127e8	2026-04-18 15:46:25.121601	2026-05-04 13:19:35.154317	123 	123	t	18d91b19-c519-4d5c-bebd-176f5538baa2	123	ARCHIVED	\N	\N	1	\N	\N	\N	\N	f	\N	\N
b38fdd70-b0fa-4f3f-926d-33b7809ff325	2026-04-12 14:46:02.079516	2026-05-04 13:19:35.940715	CTY taibui	\N	t	dba8e9b6-1486-43f8-92d1-225c269c5d62	cty-taibui	PENDING	\N	\N	1	\N	\N	\N	\N	f	\N	\N
b46ed74d-4a79-40a7-a2a1-723be34d951b	2026-04-16 16:29:58.918883	2026-05-04 13:19:36.267348	CtyTest	\N	t	c6a3f782-1142-4288-b81d-a02aa0c0dee3	ctytest	PENDING	\N	https://res.cloudinary.com/dt3crglba/image/upload/v1777797031/banner/fcbp9zvtmbjqb7pfjokw.jpg	1	\N	\N	\N	\N	f	\N	\N
0606f661-48e9-49b0-a96f-e352b99fae29	2026-04-29 13:59:31.708571	2026-05-25 04:43:56.077067	FPT Software AcademyFPT Software Academy	Hệ thống đào tạo lập trình viên chuyên nghiệp theo chuẩn quốc tế, cung cấp nguồn nhân lực chất lượng cao cho tập đoàn FPT.	t	5d6279ed-bc18-4cac-a9a4-11b871c06876	fpt-software-academyfpt-software-academy	PENDING	\N	https://res.cloudinary.com/dt3crglba/image/upload/v1778391087/banner/g9fvgwvqykvgvhpvhmwd.jpg	Education & Technology	hr@fpt-software.com	02437689048	https://fpt-software.com	Khu Công nghệ cao Hòa Lạc, Thạch Thất, Hà Nội	f	\N	Công ty TNHH Phần mềm FPT (FPT Software)
17becdc3-ba9d-435d-ab56-98fed868d69b	2026-04-27 13:58:48.060056	2026-05-04 13:19:33.524802	cty tester	\N	t	c6a3f782-1142-4288-b81d-a02aa0c0dee3	cty-tester	PENDING	\N	\N	1	\N	\N	\N	\N	f	\N	\N
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permissions (id, "createdAt", "updatedAt", permission_code, permission_name, parent_id) FROM stdin;
8feb669e-d14d-4618-b701-09bca5d60d3f	2026-04-21 10:42:41.942263	2026-04-21 10:42:41.942263	USER	User	\N
4de8902a-6873-4578-a86c-b036f2c691b3	2026-04-21 10:42:41.942263	2026-04-21 10:42:41.942263	ROLE	Role	\N
6af68350-d202-4985-8e20-52b2be5cb937	2026-04-21 10:42:41.942263	2026-04-21 10:42:41.942263	EVENT	Event	\N
3998ae52-7f26-4e81-b90b-ab43c697921e	2026-04-21 10:42:41.942263	2026-04-21 10:42:41.942263	REPORT	Report	\N
4de4fe05-6869-46c3-82d3-ab30d089d820	2026-04-21 10:42:41.942263	2026-04-21 10:42:41.942263	VIEW_REPORT	View Report	3998ae52-7f26-4e81-b90b-ab43c697921e
f8817fc7-3daf-40d7-af01-0b1d4c9beb2f	2026-04-21 10:42:41.942263	2026-04-21 10:42:41.942263	EXPORT_REPORT	Export Report	3998ae52-7f26-4e81-b90b-ab43c697921e
77d603e0-49d6-4e57-9124-e14286f49fbe	2026-04-21 10:42:41.942263	2026-04-21 10:42:41.942263	DOWNLOAD_REPORT	Download Report	3998ae52-7f26-4e81-b90b-ab43c697921e
b7a10bea-e628-4d3f-b318-81638a76dbb7	2026-04-21 10:42:41.942263	2026-04-21 10:42:41.942263	CREATE_USER	Create	8feb669e-d14d-4618-b701-09bca5d60d3f
fa24eb60-a95e-4a3c-a1ba-0507e93e6ba2	2026-04-21 10:42:41.942263	2026-04-21 10:42:41.942263	UPDATE_USER	Update	8feb669e-d14d-4618-b701-09bca5d60d3f
002173a7-f85f-4c31-8b4b-9302b1da64ec	2026-04-21 10:42:41.942263	2026-04-21 10:42:41.942263	DELETE_USER	Delete	8feb669e-d14d-4618-b701-09bca5d60d3f
bd96effd-cbe7-4e08-ad00-6221a49bbe92	2026-04-21 10:42:41.942263	2026-04-21 10:42:41.942263	CREATE_ROLE	Create	4de8902a-6873-4578-a86c-b036f2c691b3
4c30544a-93cb-4a3e-84fc-b54bdad62ce9	2026-04-21 10:42:41.942263	2026-04-21 10:42:41.942263	UPDATE_ROLE	Update	4de8902a-6873-4578-a86c-b036f2c691b3
9779e5dd-c65e-4253-b207-d0a6b906361b	2026-04-21 10:42:41.942263	2026-04-21 10:42:41.942263	CREATE_EVENT	Create	6af68350-d202-4985-8e20-52b2be5cb937
db6776f9-f0bb-4564-ab87-84b1dba839cc	2026-04-21 10:42:41.942263	2026-04-21 10:42:41.942263	DELETE_EVENT	Delete	6af68350-d202-4985-8e20-52b2be5cb937
\.


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reports (id, "createdAt", "updatedAt", reason, status, "userId", "organizationId") FROM stdin;
ea903e12-3b24-4e33-b781-ee47899af654	2026-04-13 15:16:19.757285	2026-04-13 15:16:19.757285	Inappropriate content	pending	dba8e9b6-1486-43f8-92d1-225c269c5d62	b38fdd70-b0fa-4f3f-926d-33b7809ff325
5c9edae7-dece-494e-9f84-c2751febf77b	2026-04-18 21:57:06.431669	2026-04-18 21:57:06.431669	content	pending	54666d85-c528-4bfd-b3f0-f87d803be0f4	dbcc3d57-9fc7-4e36-b283-76e4e6cc32a6
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions ("rolesId", "permissionsId") FROM stdin;
ae002b0f-3e8d-4373-83cd-e5584aebd973	8feb669e-d14d-4618-b701-09bca5d60d3f
ae002b0f-3e8d-4373-83cd-e5584aebd973	4de8902a-6873-4578-a86c-b036f2c691b3
ae002b0f-3e8d-4373-83cd-e5584aebd973	6af68350-d202-4985-8e20-52b2be5cb937
ae002b0f-3e8d-4373-83cd-e5584aebd973	3998ae52-7f26-4e81-b90b-ab43c697921e
ae002b0f-3e8d-4373-83cd-e5584aebd973	fa24eb60-a95e-4a3c-a1ba-0507e93e6ba2
ae002b0f-3e8d-4373-83cd-e5584aebd973	9779e5dd-c65e-4253-b207-d0a6b906361b
ae002b0f-3e8d-4373-83cd-e5584aebd973	4de4fe05-6869-46c3-82d3-ab30d089d820
ae002b0f-3e8d-4373-83cd-e5584aebd973	f8817fc7-3daf-40d7-af01-0b1d4c9beb2f
ae002b0f-3e8d-4373-83cd-e5584aebd973	77d603e0-49d6-4e57-9124-e14286f49fbe
68851765-0f3e-4a31-984d-6282ca6665f7	4de8902a-6873-4578-a86c-b036f2c691b3
68851765-0f3e-4a31-984d-6282ca6665f7	6af68350-d202-4985-8e20-52b2be5cb937
68851765-0f3e-4a31-984d-6282ca6665f7	3998ae52-7f26-4e81-b90b-ab43c697921e
68851765-0f3e-4a31-984d-6282ca6665f7	b7a10bea-e628-4d3f-b318-81638a76dbb7
68851765-0f3e-4a31-984d-6282ca6665f7	002173a7-f85f-4c31-8b4b-9302b1da64ec
68851765-0f3e-4a31-984d-6282ca6665f7	9779e5dd-c65e-4253-b207-d0a6b906361b
68851765-0f3e-4a31-984d-6282ca6665f7	db6776f9-f0bb-4564-ab87-84b1dba839cc
68851765-0f3e-4a31-984d-6282ca6665f7	4de4fe05-6869-46c3-82d3-ab30d089d820
6892c73d-b382-4633-8e23-59b4e7997f75	6af68350-d202-4985-8e20-52b2be5cb937
6892c73d-b382-4633-8e23-59b4e7997f75	3998ae52-7f26-4e81-b90b-ab43c697921e
6892c73d-b382-4633-8e23-59b4e7997f75	b7a10bea-e628-4d3f-b318-81638a76dbb7
6892c73d-b382-4633-8e23-59b4e7997f75	fa24eb60-a95e-4a3c-a1ba-0507e93e6ba2
6892c73d-b382-4633-8e23-59b4e7997f75	002173a7-f85f-4c31-8b4b-9302b1da64ec
6892c73d-b382-4633-8e23-59b4e7997f75	bd96effd-cbe7-4e08-ad00-6221a49bbe92
6892c73d-b382-4633-8e23-59b4e7997f75	4c30544a-93cb-4a3e-84fc-b54bdad62ce9
6892c73d-b382-4633-8e23-59b4e7997f75	9779e5dd-c65e-4253-b207-d0a6b906361b
6892c73d-b382-4633-8e23-59b4e7997f75	db6776f9-f0bb-4564-ab87-84b1dba839cc
6892c73d-b382-4633-8e23-59b4e7997f75	4de4fe05-6869-46c3-82d3-ab30d089d820
6892c73d-b382-4633-8e23-59b4e7997f75	f8817fc7-3daf-40d7-af01-0b1d4c9beb2f
6892c73d-b382-4633-8e23-59b4e7997f75	77d603e0-49d6-4e57-9124-e14286f49fbe
2db3ecec-ff64-488c-ad99-3fd8b6091406	8feb669e-d14d-4618-b701-09bca5d60d3f
2db3ecec-ff64-488c-ad99-3fd8b6091406	4de8902a-6873-4578-a86c-b036f2c691b3
2db3ecec-ff64-488c-ad99-3fd8b6091406	6af68350-d202-4985-8e20-52b2be5cb937
2db3ecec-ff64-488c-ad99-3fd8b6091406	3998ae52-7f26-4e81-b90b-ab43c697921e
2db3ecec-ff64-488c-ad99-3fd8b6091406	fa24eb60-a95e-4a3c-a1ba-0507e93e6ba2
2db3ecec-ff64-488c-ad99-3fd8b6091406	bd96effd-cbe7-4e08-ad00-6221a49bbe92
2db3ecec-ff64-488c-ad99-3fd8b6091406	4c30544a-93cb-4a3e-84fc-b54bdad62ce9
2db3ecec-ff64-488c-ad99-3fd8b6091406	4de4fe05-6869-46c3-82d3-ab30d089d820
2db3ecec-ff64-488c-ad99-3fd8b6091406	f8817fc7-3daf-40d7-af01-0b1d4c9beb2f
2db3ecec-ff64-488c-ad99-3fd8b6091406	77d603e0-49d6-4e57-9124-e14286f49fbe
db4e2c9b-1833-4b99-889d-482e406fb868	8feb669e-d14d-4618-b701-09bca5d60d3f
db4e2c9b-1833-4b99-889d-482e406fb868	4de8902a-6873-4578-a86c-b036f2c691b3
db4e2c9b-1833-4b99-889d-482e406fb868	3998ae52-7f26-4e81-b90b-ab43c697921e
db4e2c9b-1833-4b99-889d-482e406fb868	9779e5dd-c65e-4253-b207-d0a6b906361b
db4e2c9b-1833-4b99-889d-482e406fb868	db6776f9-f0bb-4564-ab87-84b1dba839cc
db4e2c9b-1833-4b99-889d-482e406fb868	4de4fe05-6869-46c3-82d3-ab30d089d820
db4e2c9b-1833-4b99-889d-482e406fb868	f8817fc7-3daf-40d7-af01-0b1d4c9beb2f
db4e2c9b-1833-4b99-889d-482e406fb868	77d603e0-49d6-4e57-9124-e14286f49fbe
73b7dba5-f19d-4682-b71d-77fcf6674352	8feb669e-d14d-4618-b701-09bca5d60d3f
73b7dba5-f19d-4682-b71d-77fcf6674352	4de8902a-6873-4578-a86c-b036f2c691b3
73b7dba5-f19d-4682-b71d-77fcf6674352	3998ae52-7f26-4e81-b90b-ab43c697921e
73b7dba5-f19d-4682-b71d-77fcf6674352	002173a7-f85f-4c31-8b4b-9302b1da64ec
73b7dba5-f19d-4682-b71d-77fcf6674352	bd96effd-cbe7-4e08-ad00-6221a49bbe92
73b7dba5-f19d-4682-b71d-77fcf6674352	db6776f9-f0bb-4564-ab87-84b1dba839cc
73b7dba5-f19d-4682-b71d-77fcf6674352	4de4fe05-6869-46c3-82d3-ab30d089d820
73b7dba5-f19d-4682-b71d-77fcf6674352	f8817fc7-3daf-40d7-af01-0b1d4c9beb2f
73b7dba5-f19d-4682-b71d-77fcf6674352	77d603e0-49d6-4e57-9124-e14286f49fbe
353d3c06-9c64-4c0f-9b43-296d1dd842a7	8feb669e-d14d-4618-b701-09bca5d60d3f
353d3c06-9c64-4c0f-9b43-296d1dd842a7	6af68350-d202-4985-8e20-52b2be5cb937
353d3c06-9c64-4c0f-9b43-296d1dd842a7	b7a10bea-e628-4d3f-b318-81638a76dbb7
353d3c06-9c64-4c0f-9b43-296d1dd842a7	fa24eb60-a95e-4a3c-a1ba-0507e93e6ba2
353d3c06-9c64-4c0f-9b43-296d1dd842a7	002173a7-f85f-4c31-8b4b-9302b1da64ec
353d3c06-9c64-4c0f-9b43-296d1dd842a7	9779e5dd-c65e-4253-b207-d0a6b906361b
353d3c06-9c64-4c0f-9b43-296d1dd842a7	db6776f9-f0bb-4564-ab87-84b1dba839cc
9204ae74-42ca-4648-848a-4c3f34decf50	8feb669e-d14d-4618-b701-09bca5d60d3f
9204ae74-42ca-4648-848a-4c3f34decf50	b7a10bea-e628-4d3f-b318-81638a76dbb7
9204ae74-42ca-4648-848a-4c3f34decf50	fa24eb60-a95e-4a3c-a1ba-0507e93e6ba2
9204ae74-42ca-4648-848a-4c3f34decf50	002173a7-f85f-4c31-8b4b-9302b1da64ec
52846daf-14c2-403a-8461-366e41b392b0	8feb669e-d14d-4618-b701-09bca5d60d3f
52846daf-14c2-403a-8461-366e41b392b0	b7a10bea-e628-4d3f-b318-81638a76dbb7
52846daf-14c2-403a-8461-366e41b392b0	002173a7-f85f-4c31-8b4b-9302b1da64ec
f9d44313-6b8b-40c9-9eb3-a5368b1f9b97	8feb669e-d14d-4618-b701-09bca5d60d3f
f9d44313-6b8b-40c9-9eb3-a5368b1f9b97	b7a10bea-e628-4d3f-b318-81638a76dbb7
cb2b71fd-fe60-43c3-a0d1-9d8e998ef2de	8feb669e-d14d-4618-b701-09bca5d60d3f
cb2b71fd-fe60-43c3-a0d1-9d8e998ef2de	6af68350-d202-4985-8e20-52b2be5cb937
cb2b71fd-fe60-43c3-a0d1-9d8e998ef2de	b7a10bea-e628-4d3f-b318-81638a76dbb7
cb2b71fd-fe60-43c3-a0d1-9d8e998ef2de	002173a7-f85f-4c31-8b4b-9302b1da64ec
cb2b71fd-fe60-43c3-a0d1-9d8e998ef2de	db6776f9-f0bb-4564-ab87-84b1dba839cc
cb2b71fd-fe60-43c3-a0d1-9d8e998ef2de	fa24eb60-a95e-4a3c-a1ba-0507e93e6ba2
cb2b71fd-fe60-43c3-a0d1-9d8e998ef2de	9779e5dd-c65e-4253-b207-d0a6b906361b
f9d44313-6b8b-40c9-9eb3-a5368b1f9b97	4de8902a-6873-4578-a86c-b036f2c691b3
f9d44313-6b8b-40c9-9eb3-a5368b1f9b97	bd96effd-cbe7-4e08-ad00-6221a49bbe92
c38c32ba-8073-40f4-9a35-af1f5817f4c4	8feb669e-d14d-4618-b701-09bca5d60d3f
c38c32ba-8073-40f4-9a35-af1f5817f4c4	b7a10bea-e628-4d3f-b318-81638a76dbb7
c38c32ba-8073-40f4-9a35-af1f5817f4c4	fa24eb60-a95e-4a3c-a1ba-0507e93e6ba2
c38c32ba-8073-40f4-9a35-af1f5817f4c4	002173a7-f85f-4c31-8b4b-9302b1da64ec
9204ae74-42ca-4648-848a-4c3f34decf50	4de8902a-6873-4578-a86c-b036f2c691b3
9204ae74-42ca-4648-848a-4c3f34decf50	4c30544a-93cb-4a3e-84fc-b54bdad62ce9
6a8dafd4-22f6-4d83-b649-57b4a45ee632	8feb669e-d14d-4618-b701-09bca5d60d3f
6a8dafd4-22f6-4d83-b649-57b4a45ee632	4de8902a-6873-4578-a86c-b036f2c691b3
6a8dafd4-22f6-4d83-b649-57b4a45ee632	6af68350-d202-4985-8e20-52b2be5cb937
6a8dafd4-22f6-4d83-b649-57b4a45ee632	3998ae52-7f26-4e81-b90b-ab43c697921e
6a8dafd4-22f6-4d83-b649-57b4a45ee632	4de4fe05-6869-46c3-82d3-ab30d089d820
6a8dafd4-22f6-4d83-b649-57b4a45ee632	f8817fc7-3daf-40d7-af01-0b1d4c9beb2f
6a8dafd4-22f6-4d83-b649-57b4a45ee632	77d603e0-49d6-4e57-9124-e14286f49fbe
6a8dafd4-22f6-4d83-b649-57b4a45ee632	b7a10bea-e628-4d3f-b318-81638a76dbb7
6a8dafd4-22f6-4d83-b649-57b4a45ee632	fa24eb60-a95e-4a3c-a1ba-0507e93e6ba2
6a8dafd4-22f6-4d83-b649-57b4a45ee632	002173a7-f85f-4c31-8b4b-9302b1da64ec
6a8dafd4-22f6-4d83-b649-57b4a45ee632	bd96effd-cbe7-4e08-ad00-6221a49bbe92
6a8dafd4-22f6-4d83-b649-57b4a45ee632	4c30544a-93cb-4a3e-84fc-b54bdad62ce9
6a8dafd4-22f6-4d83-b649-57b4a45ee632	9779e5dd-c65e-4253-b207-d0a6b906361b
6a8dafd4-22f6-4d83-b649-57b4a45ee632	db6776f9-f0bb-4564-ab87-84b1dba839cc
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	8feb669e-d14d-4618-b701-09bca5d60d3f
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	4de8902a-6873-4578-a86c-b036f2c691b3
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	6af68350-d202-4985-8e20-52b2be5cb937
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	3998ae52-7f26-4e81-b90b-ab43c697921e
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	4de4fe05-6869-46c3-82d3-ab30d089d820
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	f8817fc7-3daf-40d7-af01-0b1d4c9beb2f
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	77d603e0-49d6-4e57-9124-e14286f49fbe
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	b7a10bea-e628-4d3f-b318-81638a76dbb7
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	fa24eb60-a95e-4a3c-a1ba-0507e93e6ba2
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	002173a7-f85f-4c31-8b4b-9302b1da64ec
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	bd96effd-cbe7-4e08-ad00-6221a49bbe92
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	4c30544a-93cb-4a3e-84fc-b54bdad62ce9
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	9779e5dd-c65e-4253-b207-d0a6b906361b
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	db6776f9-f0bb-4564-ab87-84b1dba839cc
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, "createdAt", "updatedAt", "organizationId", "colorKey", role_name, role_code, "deletedAt") FROM stdin;
52846daf-14c2-403a-8461-366e41b392b0	2026-04-25 08:28:21.534466	2026-04-27 03:47:58.455283	e951c81b-7e94-49ec-a969-666dd0d127e8	red	view	VIEW	2026-04-27 03:59:24.111
cb2b71fd-fe60-43c3-a0d1-9d8e998ef2de	2026-04-26 10:20:38.574314	2026-04-27 04:06:46.012207	e951c81b-7e94-49ec-a969-666dd0d127e8	blue	view	VIEW	2026-04-27 04:06:46.011
9204ae74-42ca-4648-848a-4c3f34decf50	2026-04-25 08:24:17.904465	2026-04-27 04:07:02.469937	e951c81b-7e94-49ec-a969-666dd0d127e8	green	Staff	STAFF	\N
f9d44313-6b8b-40c9-9eb3-a5368b1f9b97	2026-04-26 09:56:56.212901	2026-04-27 04:42:43.33587	b46ed74d-4a79-40a7-a2a1-723be34d951b	green	view	VIEW	2026-04-27 04:42:43.335
c38c32ba-8073-40f4-9a35-af1f5817f4c4	2026-04-23 11:52:58.677125	2026-04-28 08:03:17.5467	dbcc3d57-9fc7-4e36-b283-76e4e6cc32a6	orange	Report	REPORT	2026-04-28 08:03:17.543
73b7dba5-f19d-4682-b71d-77fcf6674352	2026-04-21 10:45:17.145413	2026-04-28 08:16:12.398313	b38fdd70-b0fa-4f3f-926d-33b7809ff325	gray	Viewer	VIEWER	2026-04-28 08:16:12.397
6a8dafd4-22f6-4d83-b649-57b4a45ee632	2026-05-01 14:27:48.549548	2026-05-01 14:27:48.549548	12809cb8-049f-4dc9-b6a7-54c00b898108	red	view	VIEW	\N
f1f0e013-f6f7-4d4f-9e0c-33eca4a9fcc3	2026-05-25 04:38:02.022286	2026-05-25 04:38:02.022286	dbcc3d57-9fc7-4e36-b283-76e4e6cc32a6	blue	view	VIEW	\N
68851765-0f3e-4a31-984d-6282ca6665f7	2026-04-21 10:45:17.145413	2026-04-21 10:45:17.145413	b46ed74d-4a79-40a7-a2a1-723be34d951b	orange	Admin	ADMIN	\N
6892c73d-b382-4633-8e23-59b4e7997f75	2026-04-21 10:45:17.145413	2026-04-21 10:45:17.145413	b46ed74d-4a79-40a7-a2a1-723be34d951b	blue	Manager	MANAGER	\N
db4e2c9b-1833-4b99-889d-482e406fb868	2026-04-21 10:45:17.145413	2026-04-21 10:45:17.145413	b38fdd70-b0fa-4f3f-926d-33b7809ff325	green	Staff	STAFF	\N
2db3ecec-ff64-488c-ad99-3fd8b6091406	2026-04-21 10:45:17.145413	2026-04-21 10:45:17.145413	b38fdd70-b0fa-4f3f-926d-33b7809ff325	purple	Team Leader	TEAM_LEADER	\N
ae002b0f-3e8d-4373-83cd-e5584aebd973	2026-04-21 10:45:17.145413	2026-04-21 10:45:17.145413	b46ed74d-4a79-40a7-a2a1-723be34d951b	red	Super Admin	SUPER_ADMIN	\N
353d3c06-9c64-4c0f-9b43-296d1dd842a7	2026-04-25 08:11:52.946387	2026-04-25 08:11:52.946387	e951c81b-7e94-49ec-a969-666dd0d127e8	blue	Staff post	STAFF_POST	\N
\.


--
-- Data for Name: ticketTypes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ticketTypes" (id, "createdAt", "updatedAt", name, price, quantity, "eventId", "orderId") FROM stdin;
dd370298-1592-4ee5-baec-7c0e935a9d7c	2026-05-06 15:59:18.041061	2026-05-06 15:59:18.041061	Early bird 	100000	100	eba358fa-2aac-4f70-8e8d-bea468fe8cce	\N
c4db9814-ed29-4d93-898c-78d88943899b	2026-05-06 16:00:00.5166	2026-05-06 16:00:00.5166	Standard	150000	50	eba358fa-2aac-4f70-8e8d-bea468fe8cce	\N
88d03cf9-4945-4b8c-a74c-f7b74ae136cf	2026-05-06 16:00:34.265528	2026-05-06 16:00:34.265528	VIP	200000	30	eba358fa-2aac-4f70-8e8d-bea468fe8cce	\N
cd3d9cb6-2297-4d50-918f-e96d14b86d43	2026-05-07 06:34:11.710353	2026-05-07 06:34:11.710353	Vip	125000	10	75ed6480-a889-4d01-98ce-4cc2b9311a65	\N
ceebef45-1487-47b1-bb64-68ca658d7405	2026-05-06 13:41:21.498552	2026-05-07 07:55:53.324299	Standard	150000	100	75ed6480-a889-4d01-98ce-4cc2b9311a65	\N
ef9e4cda-24ae-481a-8a6f-884749aa9676	2026-05-07 08:34:48.842146	2026-05-07 08:34:48.842146	Standard	800000	10	e5555555-5555-4555-a555-555555555555	\N
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tickets (id, "createdAt", "updatedAt", "ticketTypeId") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, "createdAt", "updatedAt", email, password, "fullName", "phoneNumber", "isActive", "refreshToken", is_delete) FROM stdin;
c6a3f782-1142-4288-b81d-a02aa0c0dee3	2026-04-20 06:07:24.501381	2026-05-25 04:42:10.427672	buitaia9098787@gmail.com	$2b$10$ujZ6EMTbWy/CQcGbtuRo0Ok9F3TwszHxtafllzWofB.OpbSQMhVuK	Bùi Thành ccreate	0393515608	t	\N	f
01bc3d28-acdf-4ef1-86a9-3356b8fda140	2026-04-16 11:48:01.693032	2026-05-25 04:42:11.118266	buitaia9123123@gmail.com	$2b$10$QeJZmYpsRS/ygtYeDlCN3uwmnKkSgVKS.pchIS2GAMugXA/pc2FfS	Bùi Thành Tài	0393515608	t	\N	f
54666d85-c528-4bfd-b3f0-f87d803be0f4	2026-04-16 10:57:20.532272	2026-05-25 04:42:11.255821	buitaia9123@gmail.com	$2b$10$7XY.ZEeUpmLXYsB2yMIVDuuK1m1Rwjw9K2lXveW15rd6UhmQ3A.FC	test membership update	0123456789	t	\N	f
1c1b945d-aad5-4aa8-9674-b650110a1497	2026-04-16 17:28:59.276296	2026-05-25 04:42:14.361212	buitaia96767867@gmail.com	$2b$10$5tU2AqKa5654yIN2CDtQhObNCwanPUF/MZ/KMtmApE3qHiLfUmUoK	Bùi Thành Tài	0393515608	t	\N	f
321c3b2f-da85-4ffa-b063-1d6e8b606ee8	2026-04-17 05:50:12.897344	2026-05-25 04:42:14.972678	buitaia9777@gmail.com	$2b$10$A/wl0xm0aAxDUNKK6kYxBeabdryREEvzYLBVIQpY93SHfoVFHEfze	Bùi Thành Tài	0393515608	t	\N	f
b742ca31-ad08-41b3-aab3-4930e86a8235	2026-04-16 10:20:15.069238	2026-05-25 04:42:15.47039	buitaia99@gmail.com	$2b$10$PwFdLXj6C06OG.dI6iXNiuS8Ln.3bvXZTAU3wMc8ZFlNwk08HC0EO	Bui Tai A	0123456789	t	\N	f
bb94dbbd-12dc-4835-b0d6-ddff45b5f50d	2026-04-16 17:28:41.762492	2026-05-01 14:24:06.688677	buitaia912312322123@gmail.com	$2b$10$.b5lMHemiZXg1tk9PSxBleKfiljw2CGPNtsyZ9xTWqdrnrd/IMVYO	Bùi Thành Tài	0393515608	t	\N	t
8f0b03c3-49f8-457d-8828-ed6bcbadf23e	2026-04-20 06:07:58.659984	2026-04-26 06:21:04.206573	buitaia9674@gmail.com	$2b$10$ocJdUrydqZHqhv2rB.pxWuwQ1ba7oP/f9YAgGEunThDczYO3ojuw6	create	0393515608	t	\N	t
dba8e9b6-1486-43f8-92d1-225c269c5d62	2026-04-11 12:39:02.808733	2026-05-27 05:17:24.866588	buitaia9@gmail.com	$2a$12$T4DrRIxSCTalWi6clGTUS.NfmlQIvpG3kCkSHlJbO.1iSeaHn1zaO	Bui Thanh Tai	0393515608	t	$2b$10$vgtqNYxkCcPq5L6ZY/TkYeFWMI1MEn5xCpGie7VODBygk87BdZ0fq	f
4f78f0ea-9f0c-4ab2-8fa7-71f0172e3a74	2026-04-16 12:05:44.505178	2026-05-25 04:42:07.755087	bui@gmail.com	$2b$10$kV/vG3KxEfikJAvYqGQZxuBXdMuZAW5p7.zqsRqR/NMI1i4Icpscm	Bùi Thành Tài	0393515608	t	\N	f
28563af0-833c-4716-86a1-3a9999a71c80	2026-04-16 17:29:11.901828	2026-04-28 08:15:06.283571	buitaia9089@gmail.com	$2b$10$OzlSbKgt1PsNs8qFZ4thqOuSPHzSBDAZhPdI5zYJJ4DN9PpXtEJeO	Bùi Thành Tài	0393515608	t	\N	t
5d6279ed-bc18-4cac-a9a4-11b871c06876	2026-04-13 10:53:25.671529	2026-05-25 04:42:08.322853	buitai1234@gmail.com	$2b$10$LjyIni1f6GxqLatcJrvk3eAkDZMSRPst6bxILdpA4qnYtkZ8IHklG	Tai B	0123456789	t	\N	f
583bcdfe-b18b-4f16-a6a6-419b1933d9d3	2026-04-11 05:42:10.472846	2026-05-25 04:42:08.863688	buitai123@gmail.com	$2b$10$LjyIni1f6GxqLatcJrvk3eAkDZMSRPst6bxILdpA4qnYtkZ8IHklG	Tai A	0123456789	t	$2b$10$PX8iH/DCtKUpwC5RzezMrOtlSHmBOOtyX03CZAvP.S6mcWJVMO..u	f
18d91b19-c519-4d5c-bebd-176f5538baa2	2026-04-20 06:02:42.744991	2026-05-25 04:42:09.329299	buitaia9086@gmail.com	$2b$10$TFTeG3PVwibo29rHjMEN0OORc0kabyX.AyFtexz4y8qZBowP5mdcm	Bùi Thành Tài	0393515608	t	\N	f
5c771666-ded1-4ad2-a7b6-e5663be56a9b	2026-04-20 06:03:16.68553	2026-05-25 04:42:10.045935	buitaia908767@gmail.com	$2b$10$0DxJWov171QMmcz7HWDkIOBEQTLjRrDi44XtDXTUobBtJW9y5aj9y	Bùi Thành Tài create	0393515608	t	\N	f
c7743f2a-8392-4799-99c0-37e067d19257	2026-04-20 06:05:25.129097	2026-05-25 04:42:10.790502	buitaia91231231231@gmail.com	$2b$10$7dxYIc032S7anXmgcOJ1mOs0pzt2jcVsI8CUk1LWD8IfnWaUvK4lm	Bùi Thành Tài	0393515608	t	\N	f
d14c0c11-82c8-447e-ae85-30603b4e54c0	2026-04-16 17:28:26.338232	2026-05-25 04:42:10.986065	buitaia9123123123@gmail.com	$2b$10$vyK8vfcSN7yHkdFXxXCku.e5hBgTl.joA1MJmiE5rZle351gAZfK.	Bùi Thành Tài	0393515608	t	\N	f
08276f30-26e7-469b-8e73-91240ec18542	2026-04-25 08:15:34.414057	2026-05-25 04:42:13.731064	buitaia9312@gmail.com	$2b$10$385Gtei99WgQBA/nBU3Yn.9HLxlfeVXEbL2hTkVueO5gwsu9rmnK2	Bùi Thành Tài	0393515608	t	\N	f
\.


--
-- Name: membership_roles PK_042e725a99a075faf7f0592656f; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_roles
    ADD CONSTRAINT "PK_042e725a99a075faf7f0592656f" PRIMARY KEY ("membershipsId", "rolesId");


--
-- Name: memberships PK_25d28bd932097a9e90495ede7b4; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT "PK_25d28bd932097a9e90495ede7b4" PRIMARY KEY (id);


--
-- Name: tickets PK_343bc942ae261cf7a1377f48fd0; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT "PK_343bc942ae261cf7a1377f48fd0" PRIMARY KEY (id);


--
-- Name: events PK_40731c7151fe4be3116e45ddf73; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY (id);


--
-- Name: organizations PK_6b031fcd0863e3f6b44230163f9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY (id);


--
-- Name: orders PK_710e2d4957aa5878dfe94e4ac2f; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY (id);


--
-- Name: role_permissions PK_7931614007a93423204b4b73240; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "PK_7931614007a93423204b4b73240" PRIMARY KEY ("rolesId", "permissionsId");


--
-- Name: feedbacks PK_79affc530fdd838a9f1e0cc30be; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT "PK_79affc530fdd838a9f1e0cc30be" PRIMARY KEY (id);


--
-- Name: permissions PK_920331560282b8bd21bb02290df; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: invites PK_aa52e96b44a714372f4dd31a0af; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT "PK_aa52e96b44a714372f4dd31a0af" PRIMARY KEY (id);


--
-- Name: items PK_ba5885359424c15ca6b9e79bcf6; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "PK_ba5885359424c15ca6b9e79bcf6" PRIMARY KEY (id);


--
-- Name: roles PK_c1433d71a4838793a49dcad46ab; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY (id);


--
-- Name: org_verifications PK_ccc90df6ce7c7f75c884b625424; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_verifications
    ADD CONSTRAINT "PK_ccc90df6ce7c7f75c884b625424" PRIMARY KEY (id);


--
-- Name: reports PK_d9013193989303580053c0b5ef6; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY (id);


--
-- Name: ticketTypes PK_f19014dc7cee8888c2e59c06d4b; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ticketTypes"
    ADD CONSTRAINT "PK_f19014dc7cee8888c2e59c06d4b" PRIMARY KEY (id);


--
-- Name: invites UQ_18a9a6c85f7cc6f42ebef3b3188; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT "UQ_18a9a6c85f7cc6f42ebef3b3188" UNIQUE (token);


--
-- Name: organizations UQ_963693341bd612aa01ddf3a4b68; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "UQ_963693341bd612aa01ddf3a4b68" UNIQUE (slug);


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: feedbacks UQ_c93f9b0e556c9adf06401756fb4; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT "UQ_c93f9b0e556c9adf06401756fb4" UNIQUE ("userId", "eventId");


--
-- Name: permissions UQ_f65dbbe5dc253ff51e8a1f894df; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT "UQ_f65dbbe5dc253ff51e8a1f894df" UNIQUE (permission_code);


--
-- Name: IDX_0cb93c5877d37e954e2aa59e52; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_0cb93c5877d37e954e2aa59e52" ON public.role_permissions USING btree ("rolesId");


--
-- Name: IDX_356fd0871658ff44720aa5442e; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_356fd0871658ff44720aa5442e" ON public.membership_roles USING btree ("membershipsId");


--
-- Name: IDX_c4d8cbdf690cd24879788035d8; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "IDX_c4d8cbdf690cd24879788035d8" ON public.roles USING btree (role_code, "organizationId") WHERE ("deletedAt" IS NULL);


--
-- Name: IDX_d422dabc78ff74a8dab6583da0; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_d422dabc78ff74a8dab6583da0" ON public.role_permissions USING btree ("permissionsId");


--
-- Name: IDX_e44bcefdf09713f6a6a702839e; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_e44bcefdf09713f6a6a702839e" ON public.membership_roles USING btree ("rolesId");


--
-- Name: org_verifications FK_0371dd9f7e908fc216ac4fcfe2b; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_verifications
    ADD CONSTRAINT "FK_0371dd9f7e908fc216ac4fcfe2b" FOREIGN KEY ("verifiedById") REFERENCES public.users(id);


--
-- Name: roles FK_0933e1dfb2993d672af1a98f08e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "FK_0933e1dfb2993d672af1a98f08e" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);


--
-- Name: role_permissions FK_0cb93c5877d37e954e2aa59e52c; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "FK_0cb93c5877d37e954e2aa59e52c" FOREIGN KEY ("rolesId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: orders FK_151b79a83ba240b0cb31b2302d1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "FK_151b79a83ba240b0cb31b2302d1" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: memberships FK_1564421aeb8beb517219b10d1a7; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT "FK_1564421aeb8beb517219b10d1a7" FOREIGN KEY ("roleId") REFERENCES public.roles(id);


--
-- Name: memberships FK_187d573e43b2c2aa3960df20b78; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT "FK_187d573e43b2c2aa3960df20b78" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: ticketTypes FK_27e70a3df00330126612d6c6d58; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ticketTypes"
    ADD CONSTRAINT "FK_27e70a3df00330126612d6c6d58" FOREIGN KEY ("eventId") REFERENCES public.events(id);


--
-- Name: reports FK_2a7f46c9ab476059a4c86d05f78; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT "FK_2a7f46c9ab476059a4c86d05f78" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);


--
-- Name: membership_roles FK_356fd0871658ff44720aa5442ef; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_roles
    ADD CONSTRAINT "FK_356fd0871658ff44720aa5442ef" FOREIGN KEY ("membershipsId") REFERENCES public.memberships(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: events FK_39c9cf90409495aa82f219e95d3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT "FK_39c9cf90409495aa82f219e95d3" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);


--
-- Name: invites FK_6175bbf2e33c3d63d084c5ecea0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT "FK_6175bbf2e33c3d63d084c5ecea0" FOREIGN KEY ("eventId") REFERENCES public.events(id);


--
-- Name: org_verifications FK_736a2589726994517a2774179c5; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_verifications
    ADD CONSTRAINT "FK_736a2589726994517a2774179c5" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);


--
-- Name: feedbacks FK_9457e08001484fbd8e50698f022; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT "FK_9457e08001484fbd8e50698f022" FOREIGN KEY ("eventId") REFERENCES public.events(id);


--
-- Name: memberships FK_98d23786d647f0ccf477b3b2867; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT "FK_98d23786d647f0ccf477b3b2867" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);


--
-- Name: tickets FK_9ff866ea2cad94fc6a8106e6909; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT "FK_9ff866ea2cad94fc6a8106e6909" FOREIGN KEY ("ticketTypeId") REFERENCES public."ticketTypes"(id);


--
-- Name: items FK_b046f0b1d1b5c9e62fac38337aa; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "FK_b046f0b1d1b5c9e62fac38337aa" FOREIGN KEY ("ticketId") REFERENCES public.tickets(id);


--
-- Name: org_verifications FK_b758641b58854b99f097fd1e3a5; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_verifications
    ADD CONSTRAINT "FK_b758641b58854b99f097fd1e3a5" FOREIGN KEY ("requesterId") REFERENCES public.users(id);


--
-- Name: reports FK_bed415cd29716cd707e9cb3c09c; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT "FK_bed415cd29716cd707e9cb3c09c" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: organizations FK_cdf778d13ea7fe8095e013e34f0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "FK_cdf778d13ea7fe8095e013e34f0" FOREIGN KEY ("ownerId") REFERENCES public.users(id);


--
-- Name: role_permissions FK_d422dabc78ff74a8dab6583da02; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "FK_d422dabc78ff74a8dab6583da02" FOREIGN KEY ("permissionsId") REFERENCES public.permissions(id);


--
-- Name: ticketTypes FK_d72a921bf25a3e7c32c0be05c5a; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ticketTypes"
    ADD CONSTRAINT "FK_d72a921bf25a3e7c32c0be05c5a" FOREIGN KEY ("orderId") REFERENCES public.orders(id);


--
-- Name: permissions FK_e152e0aa9e0df7ed44539db894c; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT "FK_e152e0aa9e0df7ed44539db894c" FOREIGN KEY (parent_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: membership_roles FK_e44bcefdf09713f6a6a702839e8; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_roles
    ADD CONSTRAINT "FK_e44bcefdf09713f6a6a702839e8" FOREIGN KEY ("rolesId") REFERENCES public.roles(id);


--
-- Name: feedbacks FK_e9b6450d76be18b05b5f09d577b; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT "FK_e9b6450d76be18b05b5f09d577b" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict O4zLQy8lAKqYqRqLkzdyFEROTDabmQxpS2H0k5jwAiLrsO8MENwJctEY2B7UasA

