/**
 * One-off, SAFE-TO-RE-RUN import of the 2019/2020 blog posts from the old
 * Wix site (srmtechrobocon.wixsite.com/website/blog) into the `blogs`
 * Supabase table as already-approved historical content.
 *
 * The old blog's index page (7 posts total, confirmed via its embedded
 * `"total":7` post-count JSON — no pagination, nothing left unfetched) lists
 * exactly 7 posts, and all 7 fall in Nov 2019 - Apr 2020, so every post on
 * that blog is included here; none were excluded for being outside the
 * 2019/2020 window. Title, publish date (`firstPublishedDate`), and body
 * content were extracted from each post's server-rendered HTML (curled with
 * a browser User-Agent — the old site is Wix and mostly server-renders text
 * content into a `data-id="content-viewer"` block with per-block
 * `data-hook="rcv-blockN"` type markers: paragraph / empty-line / image /
 * video). Cover images come from each post's `og:image` meta tag, stripped
 * back to the original un-cropped Wix media URL. Embedded YouTube videos
 * (no video block type in this schema) are represented as a paragraph
 * containing a plain-text link, e.g. "[Video] https://www.youtube.com/...".
 *
 * One video embed (in "Drones to the Assistance") is intentionally omitted:
 * its player never server-rendered a thumbnail/source (an empty
 * `<div loading="lazy"></div>`), so there was nothing to recover — inventing
 * a video ID was not an option.
 *
 * Idempotent-safe, same pattern as scripts/import-alumni.ts /
 * scripts/import-gallery.ts:
 *   - Skips any post that already has a matching `blogs` row (matched on
 *     title, case-insensitive), logging "skipped, already exists" instead of
 *     inserting a duplicate. Re-running after a partial run is safe.
 *   - Re-hosts every external image (cover + inline content images) into the
 *     `blog-images` Storage bucket (covers/ and content/ folders — the same
 *     bucket/folders BlogEditor.tsx's uploadImageFile() uses, confirmed by
 *     reading src/components/blog/BlogEditor.tsx and supabase/schema.sql,
 *     not "media" as a stale doc comment might suggest). A failed
 *     download/upload is a per-image warning, not fatal — the row is still
 *     inserted with the original static.wixstatic.com URL, same as
 *     import-alumni.ts's photo_url handling. (Unlike import-gallery.ts,
 *     this is safe here: blog images render via plain <img> tags —
 *     BlogRenderer.tsx / BlogEditor.tsx — not next/image, so there's no
 *     next.config.js remotePatterns restriction to violate.)
 *
 * Every row is inserted with status='approved' (this is a historical
 * backfill of already-published content, not a new pending submission),
 * author_username='archive' / author_name='SRM Team Robocon Archive',
 * submitted_by=null (predates member_accounts), and published_at set to the
 * real 2019/2020 publish date recovered from the source site.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-blogs.ts
 *
 * Not importing src/lib/supabase/admin.ts here on purpose — it imports
 * "server-only", which is meant to throw when pulled into anything other
 * than a Next.js server bundle. Constructing the client inline instead, same
 * as scripts/import-alumni.ts. src/lib/blog.ts itself only imports *types*
 * (SupabaseClient, Database) so it's safe to import its plain functions
 * (slugify, ensureUniqueSlug, sanitizeBlocks) directly — imported via a
 * relative path rather than the "@/" alias, since plain `tsx` execution
 * (no Next.js build) doesn't resolve tsconfig path aliases — see the
 * relative import in scripts/backfill-ticket-resolution-emails.ts for the
 * same reasoning.
 */

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { slugify, ensureUniqueSlug, sanitizeBlocks, type BlogBlock } from "../src/lib/blog";
import type { Database } from "../src/lib/supabase/types";

// ---------------------------------------------------------------------------
// Source data — extracted from the old Wix site, see header comment.
// ---------------------------------------------------------------------------

const IMAGE_BUCKET = "blog-images";
const AUTHOR_USERNAME = "archive";
const AUTHOR_NAME = "SRM Team Robocon Archive";

type SourcePost = {
  title: string;
  publishedAt: string; // ISO timestamp, from the old post's firstPublishedDate
  coverImageUrl: string; // original (un-cropped) static.wixstatic.com URL
  blocks: BlogBlock[];
};

const POSTS: SourcePost[] = [
  {
    title: "Welcome",
    publishedAt: "2019-11-20T08:35:39.092Z",
    coverImageUrl: "https://static.wixstatic.com/media/b8bfb3_b057ab421ce445d090f59e3fe7a7b981~mv2.jpeg",
    blocks: [
      { type: "paragraph", text: "Good Morning/Afternoon/Evening to all people who are reading this post, we hope that this New Year has brought a resurgence in your efforts to achieve your goals. Well for those who want to learn new things about Robotics and Related Technologies, you have clicked on the right space." },
      { type: "paragraph", text: "Along this blog we will entertain you with recent trends in Robotics and update you with the projects that has been keeping us busy. Well we have dedicated a page for that in our newly refined page. Do check that out." },
      { type: "paragraph", text: "On this journey we will try to ignite the same passion that has driven us for so many years in you. Let's work in this together and build a community that we all are proud upon." },
      { type: "paragraph", text: "Stay Tuned for the next post :)" },
    ],
  },
  {
    title: "We're all in this together!",
    publishedAt: "2020-03-31T09:21:57.605Z",
    coverImageUrl: "https://static.wixstatic.com/media/b8bfb3_0a1c73a02534465e9f23c8d0eaba67b0~mv2.png",
    blocks: [
      { type: "paragraph", text: "Automation has brought in a geared change in the establishment and functioning of the medical services. While the human race continues to dwell deep and advance in medical science, nature reminds us of its superior power over us through multiple disasters. It only seems like yesterday that we were here at our lab working for ABU Robocon. And now quarantine seems to be taking over our lives. The spread of this deadly corona-virus or as we call it COVID-19 is a mark that will be written down in history for taking over the globe in a mere 6 months." },
      { type: "paragraph", text: "The outbreak of a disease is one such disaster that requires much more than manpower to control its outrageous consequences. Yes, folks! In combating this war against deadly diseases, we humans have allied with automation and robotics to improve the efficiency of results. But while we are at this war, the world is calling for its autonomous avengers. We will introduce you to them in our upcoming blog." },
      { type: "paragraph", text: "Stay tuned!" },
    ],
  },
  {
    title: "Disinfection Bots to the prevention!",
    publishedAt: "2020-04-08T15:14:58.448Z",
    coverImageUrl: "https://static.wixstatic.com/media/b8bfb3_85853fcd1bb44e69ba7aebbed1136e18~mv2.png",
    blocks: [
      { type: "paragraph", text: "During these unprecedented times, various companies are on to creating these life-saving devices so desperately needed during this COVID-19 pandemic." },
      { type: "paragraph", text: "Some of these avengers that we have come across are the Disinfection robots." },
      { type: "paragraph", text: "UVD Robots, a Danish company formed from Odense University Hospital and Blue Ocean Robotics, has been at the forefront of providing disinfection robots to China to help fight the spread of the virus." },
      { type: "paragraph", text: "The self-driving robots disinfect hospitals and other areas with ultraviolet light. This limits the spread of corona virus without exposing hospital staff to the risk of infection. The robot is safe, reliable and eliminates human error. Furthermore, it is user friendly and is designed to be operated by every-day cleaning staff." },
      { type: "paragraph", text: "The company has sold robots to locations in Europe and U.S. that are experiencing outbreak issues." },
      { type: "paragraph", text: "UVD is also seeing requests from beyond the hospital and healthcare space, including a prison that was having problems with Covid-19 cases among the prisoner population." },
      { type: "image", url: "https://static.wixstatic.com/media/b8bfb3_83aad7c6f81d441eb829c5af48f8ea65~mv2.png" },
      { type: "image", url: "https://static.wixstatic.com/media/b8bfb3_ca33b80b5818476f97cd260e504c2174~mv2.png" },
      { type: "paragraph", text: "Another set of bots have been from Los Angeles-based Dimer, that is offering its GermFalcon UV-C robots that are designed to disinfect airplanes, and its UVHammer robotic systems for hospitals and variable environments." },
      { type: "paragraph", text: "In mid-January, the company offered its services to the first three major U.S. airports where arrivals from China were taking place." },
      { type: "image", url: "https://static.wixstatic.com/media/b8bfb3_179a9234005e47ef907911b52256906b~mv2.jpg" },
      { type: "paragraph", text: "The MTR Corporation, which runs the Hong Kong subway, announced working with Avalon Biomedical (Management) Limited to develop the VHP Robot, which stands for Vaporized Hydrogen Peroxide robot." },
      { type: "paragraph", text: "The robot ensures that disinfectants get into even small gaps that are otherwise difficult to reach during the regular cleaning process. This process can eliminate viruses and bacteria, including staphylococcus aureus, E. coli and so on." },
      { type: "paragraph", text: "VHP Robot has passed through relevant tests and is claimed to have achieved the required results." },
      { type: "paragraph", text: "In the event disinfection is to be carried out, the operator can pre-set the VHP Robot to operate automatically by pre-setting the floorplan of the required area. The operator can also remotely control the robot manually with a mobile device within a distance of 20m." },
      { type: "paragraph", text: "The robot is conducting deep cleaning and decontamination in train compartments and stations to protect passengers and staff." },
      { type: "image", url: "https://static.wixstatic.com/media/b8bfb3_6ac13b875b684793ab442be833a77174~mv2.jpg" },
      { type: "paragraph", text: "Well these were a few of our prevention bots. Let us know if you've come across any such helpers!" },
      { type: "paragraph", text: "Stay tuned for the latest updates!" },
    ],
  },
  {
    title: "Bots to treatment!",
    publishedAt: "2020-04-11T14:46:37.965Z",
    coverImageUrl: "https://static.wixstatic.com/media/b8bfb3_e950c42676e944eea7c1ce3579b8e6e1~mv2.png",
    blocks: [
      { type: "paragraph", text: "To protect our medical superhumans, many countries are opting for robots to help medical staff communicate freely with COVID-19 patients without coming in close contact. Taking a look at the Ospedale di Circolo in Varese, Italy, the staff use ‘Ivo’ to communicate with the patients. The robot is little more than a tablet supported by a periscopic pole mounted on wheels, but it allows nurses to talk to patients remotely and limit their exposure to the virus." },
      { type: "paragraph", text: "The hospital also uses full robot nurses that have been employed to help manage the demand. One of them is named ‘Tommy’ after the son of one of the doctors. Tommy is one of six deployed on the ward that monitors parameters from equipment in the room, relaying them to hospital staff. The robots have touch-screen faces that allow patients to record messages and send them to doctors." },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=rJ-lbOLOmiw" },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=6_SUaupcLe8" },
      { type: "paragraph", text: "Another major help came from an Israeli-made AI-powered robot assistant Robotemi which is being used in hundreds of hospitals, medical centres, nursing homes, and corporate buildings in Asia to help minimize human-to-human contact. Up until this point, many Temi robots have been drafted for work in hospitals, air terminals and elderly-care homes. The machine is likewise being put to use in workplaces all through China to check arriving employees for fever, one of the most unmistakable manifestations of COVID-19. If a medical problem is distinguished, Temi guides the worker to a doctor’s office to abstain from contaminating colleagues." },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=jNriaEZkNJI" },
      { type: "paragraph", text: "Beijing-based robotics company CloudMinds sent 14 robots to Wuhan, China to help with patient care amid the coronavirus pandemic. The robots, some of which are more humanoid than others, can clean and disinfect, deliver medicine to patients and measure patients’ temperature." },
      { type: "image", url: "https://static.wixstatic.com/media/b8bfb3_3f0b26b5b1534795bf323e9c844295f2~mv2.jpg" },
      { type: "paragraph", text: "China researchers also designed a robot arm on wheels that can perform ultrasounds, take mouth swabs and listen to sounds made by a patient’s organs, which is usually done with a stethoscope. The robot, fitted with cameras, can perform these tasks without needing medical personnel in the same room. The robot was designed by Professor Zheng Gangtie from Tsinghua University." },
      { type: "image", url: "https://static.wixstatic.com/media/b8bfb3_d48f60d2cdca4012a6ae88ccf015f314~mv2.jpg" },
      { type: "paragraph", text: "A Cheetah Mobile-backed robotics company, Orion Star, has deployed robots in China that can help guide preliminary diagnosis and treatment, primary disclosure of medical information, and fixed-point delivery of medical supplies in hospitals. Orion Star’s epidemic prevention and control program, powered by robots, aims to reduce the workload of medical staff and reduce the risk of infection by using robots to undertake a large number of simple but labour-intensive processing tasks such as pre-diagnosis, house inspection, and delivery. The robot, which has been tested at the hospital already, uses 5G and cloud computing." },
      { type: "image", url: "https://static.wixstatic.com/media/b8bfb3_50cdaa3996ce4dcfa4b6c7fb4e6d13be~mv2.jpeg" },
      { type: "paragraph", text: "Alexandra Hospital in Singapore is using a robot called BeamPro to deliver medicine and meals to patients diagnosed with COVID-19 or those suspected to be infected with the virus in its isolation wards. Doctors and nurses can control the robot by using a computer from outside the room and can hold conversations with the patient via the screen and camera." },
      { type: "image", url: "https://static.wixstatic.com/media/b8bfb3_78a8202f0ef44ca3aad456ccf49ca8ff~mv2.jpg" },
      { type: "paragraph", text: "How many of these innovative bots were you aware of? Know about various others out there? Let us know. Stay tuned!" },
    ],
  },
  {
    title: "Drones to the Assistance",
    publishedAt: "2020-04-14T14:24:46.986Z",
    coverImageUrl: "https://static.wixstatic.com/media/b8bfb3_024961454924451f9a4d172283a11c30~mv2.png",
    blocks: [
      { type: "paragraph", text: "Amid the fight against the world threatening virus, humans have built tech that work as a strong arm in this battle. In this post let's look at the bots that are specialized in functions including transportation, surveillance etc, thereby allowing us to connect and function in remote places." },
      { type: "paragraph", text: "From being a sophisticated play toy to assessing the behavior of public,drones have always been of immense assistance to the service providing sector of the country. During such crisis time, these bots have explicitly eased the pressure of the fight. Take a look at how." },
      { type: "paragraph", text: "Chinese company JD.com, a big player in autonomous delivery systems, has used the quarantine conditions to push their autonomous ground vehicles from the lab to the street. Taking the form of miniature electric vans, JD.com's delivery robots are safely driving along Wuhan’s roads and carrying out the last-mile stage of package delivery (that is, the stage where a package is sent from the local storage hub to the client’s address). Capable of piloting themselves around complicated road conditions day or night, these robots are making the majority of the company’s medical deliveries." },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=2b2aX-t3c_g" },
      { type: "paragraph", text: "In what’s being billed as a \"world first,\" startup Manna Aero has begun a drone delivery service in Moneygall, Ireland. Delivering medicine to vulnerable people locked in their homes, it provides yet another strong example of how technology is helping the world adjust to life in the shadow of the corona-virus. The drones will deliver prescription orders for medicine to around a dozen households. Manna Zero’s founder Bobby Healy confirms the drones ensure \"zero human-contact” and can execute deliveries “in ways normal delivery can't.\"" },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=oTJKo15rqtc" },
      { type: "paragraph", text: "In France, the police have started using drones to help enforce its lock down, monitoring parks and public spaces to make sure people are not leaving their homes for non-essential trips, while, in the UK, Northamptonshire police are planning to increase their fleet of drones, which will be equipped with speakers to transmit public information messages and tell people to get back indoors." },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=-l4NsYZWEfE" },
      { type: "paragraph", text: "Through its group company Antwork, Japanese company Terra Drone is employing its UAV system to transport medical samples and quarantine supplies in China to fight the coronavirus. Antwork’s RA3 and tr7s drones and unmanned RH1 station are ensuring that medical samples and quarantine materials can travel with minimal risk between Xinchang County People’s Hospital and Xinchang County’s disease control center. The automatic, unmanned air delivery system significantly reduces contact between samples and personnel, as well as improves delivery speed." },
      { type: "image", url: "https://static.wixstatic.com/media/b8bfb3_8e47ee7f9c3645ba95282b5bd41cce96~mv2.jpg" },
      { type: "paragraph", text: "Chinese agriculture technology company XAG is actively working hard to combat the contagious disease with innovative technologies and by assisting local governments on public health and safety. They will enable XAG’s agricultural drone users to receive the much needed technical drone support to effectively carry out aerial disinfectant sprays that help curb the spread of the virus, especially in rural villages with weaker health systems and poorer sanitation conditions." },
      { type: "paragraph", text: "The Chinese government has been using drones equipped with thermal sensors. These government drones are now scanning the population to find people, potentially infected with COVID-19, who should not be out and about." },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=2NyU0bHujiU" },
      { type: "paragraph", text: "Municipal corporations in several cities of India have been spraying disinfectant liquid over using special ‘corona combat drones’ over congested slums, unauthorised colonies and markets in view of COVID-19 outbreak. The liquid sprayed by the drones has no harmful effects on humans. The sanitizing liquid being used is ‘a solution of 1 per cent Sodium Hypochlorite in water, which through its soap-like action dissolves the lipid (fatty) outer layer of Sars-Cov-2 (the virus that causes Covid-19) and kills it." },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=-8cFvxNXFQY" },
      { type: "paragraph", text: "So folks that's it for today. We'll see you with more interesting content soon." },
      { type: "paragraph", text: "Until then stay tuned and let us know your feedback and queries on @srmteamrobocon." },
      // Note: a third video embed originally appeared here (between the JD.com
      // and Manna Aero paragraphs' video and this post's other two), but its
      // player never server-rendered a thumbnail/source in the source HTML
      // (an empty `<div loading="lazy"></div>` where every other video block
      // on the page had a populated https://i.ytimg.com/... background) —
      // there was no ID to recover, so it's omitted rather than invented.
    ],
  },
  {
    title: "Inventions to Treatment",
    publishedAt: "2020-04-17T16:23:49.289Z",
    coverImageUrl: "https://static.wixstatic.com/media/b8bfb3_42b46cd907d14fcca767cc5eeaacf61a~mv2.png",
    blocks: [
      { type: "paragraph", text: "Though they say prevention is better than cure, the current situation requires us to think about the measures that would allow mankind to fight this battle more efficiently. Silenced by this deadly pandemic, multiple industries around the globe are approaching a standstill. But amid this crisis, the Medicare facility is advancing towards a much systemic and streamlined technique in combatting the disaster. Here, we present you with the various expansions in the technical facet of medical sciences that is assisting our service providers today." },
      { type: "paragraph", text: "Italian medics are converting snorkelling masks into makeshift ventilator masks in order to plug the shortage of medical equipment during corona-virus outbreak." },
      { type: "paragraph", text: "As hospitals face an overload of COVID-19 patients struggling to breathe, innovative medical staff have used 3D printed valves to adapt ordinary full face snorkelling masks from sports stores such as Decathlon into live saving equipment." },
      { type: "paragraph", text: "The idea started in Italy, the worst-hit country worst hit by coronavirus in Europe, but has now been adopted by other nations who are adding their own specific medical parts to provide critical air flow to stop patient's lungs collapsing." },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=mTejZpx59f4" },
      { type: "paragraph", text: "Amid fears of increasing demand for ventilators in view of the spread of coronavirus, researchers of Thanjavur's SASTRA university have developed ventilator splits which can double or quadruple the existing capacities. SASTRA University is successfully 3D printing PLA-based 2-way and 4-way ventilator splitters at their DST established TB facility. They are ready to be tested and served (once approved) in hospitals to address the current ventilator shortage." },
      { type: "image", url: "https://static.wixstatic.com/media/a27d24_873b55349daf4b648e4b73d679a59778~mv2.png" },
      { type: "paragraph", text: "Originally created by a robot scientist and a neurosurgeon to help India's poor, a toaster-sized ventilator is offering hope in the country's fight against the coronavirus pandemic, and demand for it is booming. The virus, at its most lethal, attacks the lungs, making ventilators - which pump air into the lungs - critical for hospitals around the world as they are swamped with COVID-19 cases. With the toll rising in India, where a nationwide lockdown is in force, production of AgVa's portable ventilator has shot up from 500 a month to 20,000." },
      { type: "paragraph", text: "The makers say the AgVa - which weighs just 3.5 kilos (7.7 pounds) - will help move less critical patients back to their homes as their machine is easy to transport and install, and does not need much power. In case there is a need to convert a hotel into an ICU, one can simply put this device and start working as it doesn't require other infrastructure." },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=uFGO4SRI3nI" },
      { type: "paragraph", text: "In China, where the number of new COVID-19 cases is beginning to decline, Beijing-based Infervision is working with hospitals to speed up diagnosis by analysing CT scans. The start-up’s AI tool was originally designed to diagnose lung cancer from CT images. Now it’s using those images to spot COVID-19 and distinguish it from other respiratory infections. The hope is by diagnosing cases more quickly, healthcare workers can limit their exposure to the virus." },
      { type: "paragraph", text: "While manually reading a CT scan can take up to 15 minutes, Infervision can process the image in 10 seconds, according to an article published in The Lancet. The technology is currently being used by Tongji Hospital in Wuhan, one of the largest hospitals with a total of 4,000 beds. Sites in other cities across China are also using Infervision’s technology." },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=sLJRNPuCpqc" },
      { type: "paragraph", text: "At Sheba Medical Centre in Israel, the hospital is taking care of a group of quarantined patients that were on the Diamond Princess Cruise Ship in Japan. A technology being used by Sheba Medical Center, TytoCare gives patients a number of tools for remote examinations. The start-up gives users a kit with tools to conduct a remote examination with their doctor." },
      { type: "paragraph", text: "For example, it includes a stethoscope that allows the physician to listen to a patient’s heart and lungs remotely, and also includes tools to send images of their ears, throat and skin." },
      { type: "paragraph", text: "The start-up, which has headquarters in New York and Netanya, Israel, began selling its kits at Best Buy last year. It works with more than 50 providers in the U.S. and Israel." },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=MkpO5CIk6i8" },
      { type: "paragraph", text: "A team at MIT developed a ventilator that could be built with $100 dollars worth of parts - a fraction of the average $30,000 cost most machines take to manufacture. The innovative design of the machine relies upon a bag-valve resuscitator, a piece of equipment found in bulk at most hospitals to help patients breathe." },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=x1L6O2gx3HE" },
      { type: "paragraph", text: "Completely submerged under the pressure to revive back to our usual functioning, the world organizations and the countries are focusing on the recovery from this pandemic. Let's do our part by staying home, thereby avoiding the further spread of this disease." },
      { type: "paragraph", text: "That’s it for now folks. See you soon." },
    ],
  },
  {
    title: "Bots to transportation!",
    publishedAt: "2020-04-21T14:55:28.167Z",
    coverImageUrl: "https://static.wixstatic.com/media/b8bfb3_e6be827a40b3470faf2bb9bef849ad58~mv2.png",
    blocks: [
      { type: "paragraph", text: "One of the critical challenges during the COVID-19 pandemic is the transportation of human, food and other services. Several unmanned and manned solutions have been implemented all around the world." },
      { type: "paragraph", text: "The battle against coronavirus in Israel just got a helping hand from an unexpected source: the robotics club at the prestigious Hebrew Reali School in Haifa. Students and alumni of the robotics club, called “Galaxia 5987 in memory of David Zohar,” answered a call from Rambam Medical Center and the Technion – Israel Institute of Technology." },
      { type: "paragraph", text: "In under a week, they developed a robot according to the hospital’s requirements. The prototype robotic platform, CoRobot, can shuttle supplies to and from the coronavirus ward to minimize the need for medical staff to enter and risk catching the highly infectious virus. CoRobot can be remotely operated by medical staff using a joystick or a smartphone app. They can see what is happening through the video camera attached to the robot." },
      { type: "image", url: "https://static.wixstatic.com/media/b8bfb3_a39fbc6f57e04847a791c9dd4525c377~mv2.jpg" },
      { type: "paragraph", text: "An autonomous shuttle capable of transporting up to 15 people will enable the transport of coronavirus patients without putting a driver at risk. The vehicle manufactured by the French company NAVYA is imported and operated by a collaborative project of the Israeli subsidiary of Singapore ST Engineering Group and Israeli BWR. The Bar-Ilan Center for Smart Cities, in collaboration with the Sheba Hospital, Tel Hashomer, is about to start testing the autonomous shuttle. The testing is coordinated with the Israel Ministry of Transport. After it’s completion, the autonomous shuttle will be “operationally activated” for isolated drives. In the next few months, the shuttle will operate at the Bar Ilan University campus for Autotech research and commuting students around the campus. The vehicle is equipped with cameras, laser sensors, and high-performance guidance and detection systems supplying it with situational awareness. The vehicle is environment-friendly thanks to its 100% electric autonomous system. The possibility of using this autonomous vehicle also for the delivery of medications, laundry, and food for the patients at the hospital’s isolation sites is also considered." },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=7rsq2qSz4VA" },
      { type: "paragraph", text: "A robotic delivery service in Milton Keynes could prove to be the future of locked-down Britain, as miniature autonomous vehicles bring food deliveries to almost 200,000 residents of the town." },
      { type: "paragraph", text: "Starship Technologies, an autonomous delivery startup created in 2014 by two Skype cofounders, has been testing its beer cooler-sized robots in public since 2015. The small, white, six-wheeled vehicles trundle along pavements to bring small deliveries to residents and workers of the neighbourhoods in which they operate, without the need for a human driver or delivery person." },
      { type: "image", url: "https://static.wixstatic.com/media/b8bfb3_48b551097c6c4b5eb268b757d652f5d7~mv2.jpg" },
      { type: "paragraph", text: "ROBOMART is the robot vehicle will bring fruits, vegetables, and other perishable items from the supermarket aisle to customers' doors. The cargo area of the vehicle will be refrigerated and offer multiple shelves of various types of produce." },
      { type: "paragraph", text: "According to Robotmart founder Ali Ahmed, the company could compete with the on-demand giants taking on grocery delivery services, like Amazon, Instacart, and Postmates. Supermarket chains would license the platform and robots for a two-year lease, which Ahmed said will still be cheaper than opening a new store. They pocket the delivery fee instead of the on-demand operator." },
      { type: "paragraph", text: "[Video] https://www.youtube.com/watch?v=srGGZqO3UbY" },
      { type: "paragraph", text: "Avoiding direct contact with infected person is a medical priority. An immediate monitoring and treatment using specific kits must be administered to the victim. The Ambulance Robot (AmbuBot) could be a solution to address those issues. AmbuBot could be placed in various locations especially in busy, remote or quarantine areas to assist in above mentioned scenario. It also brings along an AED in a sudden event of cardiac arrest and facilitates various modes of operation from manual to semi-autonomous to autonomous functioning ." },
      { type: "paragraph", text: "The ambulance robot could be operated remotely using internet and doctors could instruct the local people for appropriate action. The robot could carry any required medical kit such as thermometer, AED, Coronavirus test kit, etc. Doctors could have bi-directional communication via the robot equipped with audiovisual channels. They could even remotely operate the robot wheels and arm." },
      { type: "image", url: "https://static.wixstatic.com/media/b8bfb3_85bea4c926b548eda43cbe89f3031cd4~mv2.png" },
      { type: "paragraph", text: "Do you know about many other robots out there?" },
      { type: "paragraph", text: "Write to us and let us know :)" },
      { type: "paragraph", text: "Stay tuned!" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Escapes %, _ and \ so a title is matched literally (case-insensitively), not as an ILIKE wildcard pattern. */
function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Downloads an external image and re-uploads it into Supabase Storage.
 * Returns the new public URL, or null if anything went wrong — the caller
 * falls back to the original URL rather than treating this as fatal (see
 * header comment: blog images render via plain <img>, not next/image).
 */
async function rehostImage(supabase: SupabaseClient, sourceUrl: string, folder: "covers" | "content"): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) {
      console.warn(`      [rehost] fetch failed (${res.status}): ${sourceUrl}`);
      return null;
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : "jpg";
    const storagePath = `${folder}/${randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(storagePath, bytes, {
      contentType,
      upsert: false,
    });
    if (error) {
      console.warn(`      [rehost] upload failed for ${sourceUrl}: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err) {
    console.warn(`      [rehost] error for ${sourceUrl}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** True when a `blogs` row already exists with this title (case-insensitive). */
async function alreadyExists(supabase: SupabaseClient, title: string): Promise<boolean> {
  const { data, error } = await supabase.from("blogs").select("id").ilike("title", escapeIlike(title)).limit(1);
  if (error) throw new Error(`lookup failed for "${title}": ${error.message}`);
  return Boolean(data && data.length > 0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set (run via `npx tsx --env-file=.env.local scripts/import-blogs.ts`)."
    );
  }

  const supabase = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Importing ${POSTS.length} historical blog post(s) from the old Wix site...\n`);

  let inserted = 0;
  let skipped = 0;
  let insertFailed = 0;
  const rehostFailures: string[] = [];

  for (const post of POSTS) {
    let exists: boolean;
    try {
      exists = await alreadyExists(supabase, post.title);
    } catch (err) {
      console.error(`  [error] "${post.title}": ${err instanceof Error ? err.message : String(err)}`);
      insertFailed++;
      continue;
    }

    if (exists) {
      console.log(`  [skipped, already exists] ${post.title}`);
      skipped++;
      continue;
    }

    console.log(`  [importing] ${post.title}`);

    // Cover image.
    let coverImageUrl: string = post.coverImageUrl;
    const rehostedCover = await rehostImage(supabase, post.coverImageUrl, "covers");
    if (rehostedCover) {
      coverImageUrl = rehostedCover;
    } else {
      rehostFailures.push(`${post.title} (cover)`);
    }

    // Inline content images.
    const rehostedBlocks: BlogBlock[] = [];
    for (const block of post.blocks) {
      if (block.type === "image") {
        const rehosted = await rehostImage(supabase, block.url, "content");
        if (rehosted) {
          rehostedBlocks.push({ ...block, url: rehosted });
        } else {
          rehostFailures.push(`${post.title} (inline image)`);
          rehostedBlocks.push(block); // keep original URL, non-fatal
        }
      } else {
        rehostedBlocks.push(block);
      }
    }

    // Safety net + limit enforcement, same as any normal submission path.
    const sanitized = sanitizeBlocks(rehostedBlocks);
    if (sanitized.length !== rehostedBlocks.length) {
      console.warn(`      [warn] sanitizeBlocks dropped ${rehostedBlocks.length - sanitized.length} block(s) for "${post.title}"`);
    }

    const baseSlug = slugify(post.title);
    const slug = await ensureUniqueSlug(supabase, baseSlug);

    const { error } = await supabase.from("blogs").insert({
      title: post.title,
      slug,
      cover_image_url: coverImageUrl,
      content: sanitized,
      visibility: "public",
      status: "approved",
      submitted_by: null,
      author_username: AUTHOR_USERNAME,
      author_name: AUTHOR_NAME,
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
      published_at: post.publishedAt,
    });

    if (error) {
      console.error(`  [insert failed] ${post.title}: ${error.message}`);
      insertFailed++;
      continue;
    }

    console.log(`  [inserted] ${post.title} (slug=${slug}, ${sanitized.length} blocks)`);
    inserted++;
  }

  console.log("\n========================================================================");
  console.log("  SUMMARY");
  console.log("========================================================================");
  console.log(`  Inserted                : ${inserted}`);
  console.log(`  Skipped (already exists): ${skipped}`);
  console.log(`  Insert failures         : ${insertFailed}`);
  console.log(`  Image re-hosts failed   : ${rehostFailures.length}${rehostFailures.length ? " (kept original URL)" : ""}`);
  if (rehostFailures.length) {
    rehostFailures.forEach((n) => console.log(`    - ${n}`));
  }
  console.log("========================================================================\n");

  if (insertFailed > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error("\nImport failed:");
  console.error(err);
  process.exit(1);
});
