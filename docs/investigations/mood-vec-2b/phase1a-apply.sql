-- MOOD-VEC-2b Faz 1A: 285 arşiv filminin curation_tier'ı (DB'de rating+votes zaten dolu). HAZIRLANDI, ÇALIŞTIRILMADI.
-- Yalnız films.curation_tier değişir. Her UPDATE filmin hâlâ archive olduğunu doğrular (kayma varsa 0 satır).
-- Beklenen: 285 UPDATE × 1 satır. Geri alma: phase1a-rollback.sql.

BEGIN;

-- Yedek: değişecek 285 filmin önceki değerleri. Tablo zaten varsa bu satır hata verir ve işlem durur (üzerine yazma yok).
CREATE TABLE films_phase1a_backup_20261031 AS
  SELECT id, curation_tier FROM films WHERE id IN ('01cdb17a-57c5-4ba3-84b4-5dcb0b54c902', '027758d2-17e6-49dc-8772-01b02543beef', '034e4624-dc92-4df0-a98c-664548b9ac7f', '03d5611a-ca7a-4224-bdcc-5934bfc0ac22', '03eeb7df-d422-492d-a78b-24f762cc7b06', '043506fc-4347-4f56-a43a-8a6452a4719a', '051602cb-e012-4024-b0a2-b37311c18922', '06547dd2-1910-48aa-821c-81b6c9462ca1', '06dce849-bb32-46c2-abb8-1f363a5ecb6a', '0703aa6c-28ba-4c1a-bc8a-0838a79ce4a3', '09d7864e-2b87-44a0-ba59-3e5dda5c78a1', '0ad988cd-0575-44d5-8862-7e4c6e72ea68', '0b58e47d-764c-4b5c-a028-6ae8039237fd', '0b930836-7430-471d-a943-8720cc57581d', '0da5b546-6328-42c2-97a6-1443fe11afe0', '0e473037-fc51-4739-bbe1-b87633f17871', '0ea92565-a76b-43d7-8edf-77fd5674d951', '10176d4c-ff86-4442-82bb-67e653996e83', '1196693e-a4d3-4e60-a78c-6547336ed805', '11d0cbb5-59a3-424d-a1d8-14bee3b889cb', '11db55c2-63e2-4524-9baf-ba1e822ab5d2', '12d76355-63ea-43b0-bcd7-7c9bda36ac02', '131f4df3-d55d-4263-90de-12df4aaeb559', '13cf685a-f9f1-4203-88fa-be26425ea7b8', '13e91e46-87c4-4635-aa56-4793d48a43c1', '1567d06b-a490-4d14-9915-f13407b7f0b8', '1ae97a48-994d-41ec-8259-984f39346ec4', '1b7fb381-6f4c-4875-8d3a-8b6d36f73d2c', '1c589cd9-853d-4f97-af4d-91bb55e9157b', '1ca18070-bab9-4e70-a912-f605bb777cfe', '1cf69374-a9e1-4588-90c1-bd8f968d3b90', '1dde7817-37ae-4d56-ac3b-d5ecfe4cb8f9', '1e78b1d8-b260-4ea2-bb62-bfa259b3afdc', '1eeecdd0-a477-472c-875e-526fe40966e6', '1f36b8b7-ac62-48be-acbd-17bef716b3bb', '1f4ed9a3-d2ec-4e76-b2cf-6739f4cda218', '1fe7934b-04d2-493d-af25-a009bd86157a', '206b3509-a1d9-4c55-a269-ce9f87cccc1c', '2185f720-5a8a-453c-9810-ba23a7491858', '21b5214e-6055-465f-b053-3542bd7fe8cd', '227632a7-9936-4fdf-a42f-d86f453fa16b', '2281c3a5-1f86-4293-b7d2-7d0bdf4b9a3e', '239caf7c-a7b4-4d1b-8aa5-ba7c5f5cfc5b', '251b49c2-bef5-4ba6-a673-0cf19ff7f4fd', '258ac055-79e6-4dd0-9221-76f330abb047', '291e176c-9fac-48f1-9e6f-ff16a11fd830', '2cea9ff1-1a57-4bc6-89b0-e77f5da023de', '2d636056-f749-4909-b04a-812d2d7aaebb', '2d890ab0-9535-4b46-947d-ff27ddd8deb4', '2e2087d9-5726-4ac4-ac44-921a623638b3', '2ed8bcd2-11a4-40c4-99ca-ffbcbf6fe8ad', '2ee4fbd3-df0e-4c67-b71c-5e28a2d29876', '2fade49f-c99e-4b51-ba44-3eb8ed5928d1', '31b9a72f-4123-495b-9d59-78148eb8cf68', '31d43963-4e9a-4bf0-af98-1c7e03be69b0', '325b7736-a409-44e7-a980-8ae937347b45', '33043831-132c-45d1-a340-6e4a2f53e631', '3308961b-d138-4a46-853e-c32190bc4069', '33cb1a29-7c4f-4dc8-b13e-42f5f2bd2233', '340be1ee-6e12-4713-873a-9e43bb85b7e4', '363e0143-a063-412a-8cc6-6bdc3a0fd7fd', '36d84ff7-717d-4f55-8788-1958c2310607', '36ddb864-8233-4c68-9e82-6c65768d363b', '38198cf8-4c06-4ff9-9711-e0e6f595eedb', '38eb4d5b-00b7-433b-b642-9cb67cb1495f', '39e94ac2-ec88-48b5-89b9-deb994da1de5', '3c3dec29-f881-4d47-8908-b4c126faa6d0', '3e09ef5f-1aac-4802-a70b-a816721452a4', '3efe73f1-c2df-4494-adc3-de157d8fc37d', '3f06d748-214f-4aeb-8049-7d35bb24d1db', '3f8b189a-6c42-4f4c-84e0-c48056c0ed77', '3fab178d-ec74-42ca-b90e-bc2ba784e6ae', '3fe2daec-c25a-4094-af04-e685d3e92300', '3ff8668c-271b-4721-bf87-f2232f014dc3', '423b2b6c-a071-484b-8076-d32575e5cf03', '439648cf-3cdc-41cf-af7b-abe74c3c51da', '448ac33b-af43-48cf-8ba8-882aaebc4e71', '44e59f0a-b5bf-4a8b-bfe1-f35f49046550', '453a4df3-f613-4846-af6e-494da889194d', '456355cc-a774-45b6-beac-91dfac23769e', '46dfe99d-e448-44e9-9c11-4ea02a162221', '47292992-af1b-4e47-a193-3e2e09534c16', '4a7a6058-1286-4ccc-8e59-664428beb693', '4a9b5c77-0ee4-4c03-9633-86de7abb434c', '4bf342e3-a060-4d45-a074-374a14c22759', '4d48ec5c-aa25-457e-b924-f1b878bb7d66', '4dfaef83-9d19-4a05-ad92-b0d44e8bd411', '4efba55a-cc49-4baf-81a2-c5d6ebf22c15', '4f09e39f-f9b6-4514-9f89-1ff35090ddf2', '5004246c-99a0-4289-8d68-b8259bd88d2e', '51634919-cb7d-4489-8dd4-e2b148a811ee', '52ab300b-ead5-45c9-b84b-7f389ff566d5', '53d95dda-5da5-4cc5-8c7b-aa50fcaca2d4', '56094c0d-c1ad-415d-9f57-46c94d8d2ed2', '56438f31-e5c3-4268-857f-5033ec1e6958', '574665b0-e192-4152-a61b-bbef026047ab', '59c77758-5e6e-47b4-8ddd-3d5ff6203a61', '5b3f9148-9542-4c95-b9c4-f6ca05df456b', '5b937f7a-f68a-40f3-8481-371c538f69e1', '5f99756e-d93c-4c31-ba5c-73534a1b6f73', '600783fc-7908-42d3-afa7-4a1a01ce14a8', '61ed41ea-7f39-4519-a196-0474ce90c33b', '6243e1b9-0a2a-4a75-8965-9b2cb00828a2', '634fec75-7e9d-4c85-b501-5b38bf711f4a', '63a7355b-3f9a-441b-baa4-32107ada8c11', '63d9c9b3-b1a6-42a1-8f57-aaa4de3c86a9', '65c8ae38-b7b3-42da-8a1b-0d910a18dc7c', '6664bbd8-32e6-474b-afc3-de96e34c3dec', '66bc13f9-b1f6-4088-aa20-134a25bcf696', '670e0ae6-d340-4b36-b0e1-51ba97803d6d', '681551fe-6bcf-4533-ac44-e5c8c8dcf3cf', '68435bdd-498f-4339-8320-b4d2c8623dc5', '6b1ac344-5857-4a5a-851b-d4f68deb053e', '6b85228f-bb02-4e6c-a065-5180bc1953a7', '6c2fe8ed-61fd-4761-bd0a-2083c6784919', '6db5a6cc-56d3-4978-b0b2-51b49910bfab', '6dc8d982-a1a8-4a9a-8ef7-e18d6f46dceb', '705b691c-1e4f-45ff-9da7-ccfce2fce23d', '70ae93d3-166a-4239-aff3-c10dfe0bc243', '71c28f3b-7375-4353-99c9-df0957a1e034', '746c36d4-da4f-4231-92f0-803dedda19a0', '7558f34a-eca9-4e8d-9191-a664519f9fa6', '76029869-eb49-40a9-9d6e-5de8e054c294', '77e564c5-292c-4402-bd29-ece23e7a35e1', '7805287d-0bca-4877-acc5-771819ca1e2c', '78631283-1fcd-437a-955e-9d4dd97c19ae', '788eda87-9875-417c-a7be-65e5d2d52e51', '789fe274-70c1-49f8-9dc3-bbcb91c02228', '7a188483-e5e7-4fa7-ae2f-e51998460fb3', '7c1d6129-e523-40a4-9b9c-be06e1a7f9be', '7c1f2ec5-a3d9-4972-9393-ecb65f97a2d1', '7c7a0e6d-dbd1-43b8-ac51-f834d948833e', '7c9e8338-e918-4355-98ba-f991f8c4a1e6', '7dc07448-582f-4588-b525-25ce3f8e4db4', '7dc18fc7-27ab-4dcc-a4c2-a4339cfd4915', '7e400d42-cebc-4554-b708-b6f1dbfbdb56', '801dff16-4f26-4952-9664-57d606e26797', '806c845d-a95f-4b83-8b56-b6b3e0c1c832', '81a3af96-bb75-4f12-9143-d39c2ac0275e', '81d89861-f723-45c7-af78-d2a2159e965a', '827aa7d3-0030-4984-b4f4-85f7adb3c521', '837397a9-e4bf-4755-a462-9e7455fd0563', '837fc5de-577d-48a6-b190-8675518d72ff', '85b3834d-ddd1-4dc7-a1e0-f51c6be29d26', '8633326f-b88a-4d67-aa69-cb2a46d9bb42', '86d33516-6d93-4444-89f2-a1536cd62e82', '8846082b-127c-4e5a-b604-3c8493d23fd5', '8846ea90-ecc7-4e49-af0e-b1a97b43f245', '8a69d803-c409-4ad1-a325-0495564d6005', '8ac2a36e-13e9-42ca-b60d-f06279e761c3', '8d2811e8-b8a3-4431-935b-b224d6ba829f', '9050bdf5-48fc-4434-87b8-198839fe006a', '90a32829-c7fe-474d-8391-3823cb42d0de', '90a41f20-5448-4542-89fd-2209644a2a0d', '912dd8c0-6c03-44d9-b90a-3c4c08c7e459', '9194bc94-32f1-42d0-a95f-b1416837289b', '919fc483-8cd8-43c8-ad7c-727cddd8cc75', '91bf3a6f-2f96-4f4d-9f6c-84e14d029cc3', '926c0560-62c4-4bb7-a6d0-8318ba08c532', '92c61fd6-bedb-46dc-9fbc-81496f3d856e', '94260daf-36be-4e59-8f19-d5fea3c2bf28', '94e19d34-73ff-42fa-afc1-730c28e243b2', '94e8c5cc-2f73-4fb5-a497-6c4be8da12d9', '95bd27a2-6650-4964-8b69-c6447d6576ca', '97912570-8927-4a21-b8f1-121026d5cf5a', '9910804b-8e7e-4da4-bdf6-55fd28d58d59', '99fcf6c8-b173-43b5-9da5-ab1cfc900b3d', '9c15981f-7f81-4daf-9cfb-9041b392480a', '9c983c98-1419-43d5-9b16-74a1b7588dfe', '9d2a1457-39bf-4454-85d0-ac82e05c9127', '9d2ac55b-4be1-406a-aa3f-c112e32a9ea8', '9e3f2256-5ce9-4a2d-aafc-5ebfa87168f4', '9fb78847-79a5-4342-9b76-2945ecc7cd28', '9fe39854-4a0c-4398-95c4-abec922e1335', 'a056fc8c-4a52-486c-8409-b3099c2aa53c', 'a0b32c7e-3344-4961-aca7-cf3d4bf4a2da', 'a123410d-e0fb-48c6-a4ee-a5a715a13cf1', 'a14861e1-4635-4e9f-89a9-ecd515dfcc09', 'a299bf4e-7dc6-4af3-8979-f602ebc9289c', 'a521ad34-9fb2-4d7d-89c5-40259b937bd5', 'a5f05571-7b76-4188-91ee-8d00b2336bf0', 'a76f8bfe-9254-49c8-be3a-1165a605adfc', 'a7f601ea-635b-458f-bff7-d26641508cad', 'a834e817-5a12-4cb4-a44a-8f19ebe967b1', 'a8882105-8999-4bf2-9217-d4f83f893bdf', 'a9c6ed4b-aa2f-4453-880f-ffda4688a99f', 'a9d8e55d-2586-4d60-bd1e-96907e9fa758', 'ab941b87-649f-49d1-9779-a17c1c55dd3b', 'ac0f6c20-c4ab-436d-af4f-94016f84a42a', 'acfa8601-1b9b-497d-87f1-fc2598761826', 'adf9adf2-2723-441b-818a-b4a76fd70cce', 'af3bc99e-4aab-4797-b597-60fdec3e62c7', 'b1337879-10dd-46e0-95a5-4de16a9e5597', 'b1d84ddf-e137-4fc8-be2c-d4142f826e5e', 'b21671eb-f596-4480-8981-0be6043cf51b', 'b569053a-f837-44a0-a1e8-435786b41dcb', 'b6b8df2a-9e00-4c86-8a9c-f2e522788fb7', 'b979604c-f128-4efb-83d9-46e20a0f2d73', 'ba2ce628-aa9f-4bac-aa19-d94fade0752f', 'ba4aa167-c547-4140-8bc4-572df332f977', 'bad75619-777e-42be-a91d-0c6b51c300c6', 'bca12e40-1646-49df-8a5a-ed3ec89ce1d3', 'bdb0eb6e-0811-4422-a801-7f04603a3922', 'be8a8274-06f8-467a-a2d2-db098bb7c577', 'bf2504a7-4310-4012-9df2-cfc82391370d', 'bf2d5bfc-89ca-44d1-b7e0-313fbbccd584', 'c05e141f-c1eb-4273-b8b8-5a5e50eb7562', 'c097be44-8a9a-4d7a-a75a-091f0412ef7f', 'c0ae5161-7861-4263-9b0b-5750a6ee86ba', 'c0e34762-8d7d-4f3b-a51d-9081c0437ec1', 'c11b222b-fac5-410a-baf8-08fab6ebed3d', 'c234693e-98aa-473c-9f5f-60f6376dc8f4', 'c24791be-05f1-48d8-bfa7-a2e2263a341c', 'c43862f3-4a9d-44c0-8fed-2ed51484c5b4', 'c473662c-8e7f-426c-a00f-25fa482e650f', 'c519ef4c-6301-45c1-8bc3-012f8c4fbe76', 'c53664d2-7fa8-480d-9957-73c305ea4276', 'c599c165-1f31-414c-8dbd-ac280420e67a', 'c6c5fb21-50ff-40d5-873e-302eab18bae4', 'c7329bf7-925f-46f0-bb0a-dad21061d52b', 'cb235f44-6062-43db-8396-cbe61db95f0f', 'cb5c6eb1-04d7-46e2-a95e-addd78a251cd', 'cd5d8659-d54e-47d8-941d-9c34f5a51415', 'cdd0eeb8-fc83-48a9-8475-6ed46894c05c', 'ce80b119-3efd-4172-8684-cdc16955e50c', 'cebb3fab-8f9d-4046-9ead-e03a4d0d4209', 'cf0c6e0e-f3dc-4f52-9e77-f1bda57f0b67', 'cfbd3eb4-a80c-4b4b-9740-51b21a5d97cd', 'd0f83a8d-5353-434e-be27-3b4a1c9acc7e', 'd290289f-a9f5-4811-aa0d-8739ab57399d', 'd2983991-79b5-4ea0-aafe-dd71265d1576', 'd3b2de76-f579-4de1-b275-b0b59beca885', 'd5dad7d7-e1c1-4b4e-a088-61a0a4679195', 'd73783f8-fec8-465c-91c5-915cfd9d40ca', 'd7e06127-f8e0-419a-b7b3-aed90b37ceaa', 'd8b36078-715a-4837-bd12-9055a9e6e11b', 'da6eb4dd-b0e8-4871-86e6-b2fb04e586fd', 'db12370a-d35f-4cf1-b77b-6609bd90da4a', 'db8ae63e-ef64-47a8-a437-655d62cc6684', 'df45d89f-f299-487d-b70f-a68c536f5016', 'df8e75ee-1fb0-4f88-9978-fd62d8a59320', 'dfc688d6-10b9-4e70-b6fe-5c373c0221e9', 'e28ddb48-2732-4598-8a29-a2157a68be11', 'e2f1bd3d-a52d-41ed-b82d-8de5e2b3debf', 'e329469f-4a60-4177-87dc-cf546267e317', 'e34d532e-cc6e-4470-a4fa-1e2a07c8589e', 'e414bbb7-6311-4fa5-9fd6-1f328e37415d', 'e41ed28b-15e4-4687-854d-353f5d0ee736', 'e42bccfb-078a-49b3-a75a-93c4325e66a1', 'e5a3c4dd-0abf-45c5-8035-60ef554f7b8e', 'e73feb4f-7dbd-480b-ad22-2a416eb60fe5', 'e78929bb-6fa6-423c-9dd1-e741edecfd7a', 'e7c7ce77-d2e9-41a1-93ee-a747fab9b0dd', 'e81567ac-cde0-4c0b-be29-2c76507277d7', 'e952464c-1e4d-4451-90a4-dfd757414a25', 'e9ebe147-2b31-4e80-9d8a-d8454dcbd5d5', 'ea6c3a14-68bf-4a53-8afe-e356e5008ea1', 'ec585efd-cbbe-4dac-a6b3-d2ba3976002f', 'ed108e6b-1626-47b7-bfd1-cbb399ca01d5', 'ed756f87-3d74-4c3f-a603-7acc801589d7', 'ee79942f-a0b8-4a98-af96-6aa72330444c', 'eed542f8-994a-46df-a615-5a5207ae5ee6', 'ef5599f9-bd6f-4612-8bd7-38f75d1fb07f', 'efae869a-f06c-4a26-86b9-ee54e5d640c3', 'f01f0f9d-3764-4497-9119-2001890e9d41', 'f21b8b56-61f5-4f15-a712-b9d3b8efe8b9', 'f2cff521-349b-4712-b5c9-541b5a50ec93', 'f4a7b9c0-f617-4a43-9625-7819d3e01df0', 'f6b353bf-b61d-4eac-be05-a05ab9a45258', 'f744f73a-70ba-46d1-9459-9f4cdcf17c12', 'f75c5819-077f-4fef-aab0-0dc0d6d42aca', 'f76c6fa2-d04c-419c-bae7-5cd8d472e223', 'f78c275d-4869-4c2f-9415-170ad247c02d', 'f78de828-e62e-4cec-a23e-f3e67087dd5e', 'f7d4c3e7-7362-4118-bde8-797274c40127', 'f8dc6190-af74-4f1f-8065-9ba1ebf0b1fb', 'f8f6d81e-f691-4723-a4d5-0d630fb97f36', 'fa061b3a-09f1-4a7d-acf4-2eb2fde576b5', 'fa3b7914-9b27-4cd1-a596-51e623a78523', 'fba61561-3903-4d1b-827f-d3d476207d2b', 'fbcf31d8-8c0b-4fc4-b5ab-3908963e002c', 'fce4490a-640a-4c88-8cd3-57b531043d81', 'fe43f9f6-ad68-4e2e-8fee-a3951819e8fe', 'ff5b4b7c-e79e-4ea2-9eb1-7e9baf4d79a2', 'ff86498c-c399-4190-955c-ea4ccea91eb5');
ALTER TABLE films_phase1a_backup_20261031 ENABLE ROW LEVEL SECURITY;

-- Innocent Voices (2005, 7.8/8319) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '01cdb17a-57c5-4ba3-84b4-5dcb0b54c902' AND curation_tier = 'archive';
-- My Fault (2023, 6.1/43031) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '027758d2-17e6-49dc-8772-01b02543beef' AND curation_tier = 'archive';
-- Montage (2013, 7.4/9025) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '034e4624-dc92-4df0-a98c-664548b9ac7f' AND curation_tier = 'archive';
-- New York Stories (1989, 6.4/20904) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '03d5611a-ca7a-4224-bdcc-5934bfc0ac22' AND curation_tier = 'archive';
-- Animal World (2018, 6.4/5324) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '03eeb7df-d422-492d-a78b-24f762cc7b06' AND curation_tier = 'archive';
-- All Your Faces (2023, 7.5/5115) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '043506fc-4347-4f56-a43a-8a6452a4719a' AND curation_tier = 'archive';
-- Despicable Me 4 (2024, 6.2/76384) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '051602cb-e012-4024-b0a2-b37311c18922' AND curation_tier = 'archive';
-- Secret Agent (1936, 6.4/9469) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '06547dd2-1910-48aa-821c-81b6c9462ca1' AND curation_tier = 'archive';
-- The Peasants (2023, 7.6/9057) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '06dce849-bb32-46c2-abb8-1f363a5ecb6a' AND curation_tier = 'archive';
-- TRON: Ares (2025, 6.2/78081) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '0703aa6c-28ba-4c1a-bc8a-0838a79ce4a3' AND curation_tier = 'archive';
-- The Keeper (2018, 7.3/7239) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '09d7864e-2b87-44a0-ba59-3e5dda5c78a1' AND curation_tier = 'archive';
-- Bleeder (1999, 6.8/9890) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '0ad988cd-0575-44d5-8862-7e4c6e72ea68' AND curation_tier = 'archive';
-- The New Land (1972, 8/5451) → core
UPDATE films SET curation_tier = 'core' WHERE id = '0b58e47d-764c-4b5c-a028-6ae8039237fd' AND curation_tier = 'archive';
-- Fellini's Casanova (1976, 7/9315) → core
UPDATE films SET curation_tier = 'core' WHERE id = '0b930836-7430-471d-a943-8720cc57581d' AND curation_tier = 'archive';
-- Green Border (2023, 6.4/7524) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '0da5b546-6328-42c2-97a6-1443fe11afe0' AND curation_tier = 'archive';
-- Water and Fire (2013, 6.1/5080) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '0e473037-fc51-4739-bbe1-b87633f17871' AND curation_tier = 'archive';
-- Hatred (2016, 7.6/7484) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '0ea92565-a76b-43d7-8edf-77fd5674d951' AND curation_tier = 'archive';
-- Vabank (1981, 7.9/5105) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '10176d4c-ff86-4442-82bb-67e653996e83' AND curation_tier = 'archive';
-- Boccaccio '70 (1962, 7/5568) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '1196693e-a4d3-4e60-a78c-6547336ed805' AND curation_tier = 'archive';
-- The Anthem of the Heart (2015, 7.3/6982) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '11d0cbb5-59a3-424d-a1d8-14bee3b889cb' AND curation_tier = 'archive';
-- A Swedish Love Story (1970, 7.3/7731) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '11db55c2-63e2-4524-9baf-ba1e822ab5d2' AND curation_tier = 'archive';
-- Fists in the Pocket (1965, 7.6/5358) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '12d76355-63ea-43b0-bcd7-7c9bda36ac02' AND curation_tier = 'archive';
-- Shoeshine (1946, 8/8540) → core
UPDATE films SET curation_tier = 'core' WHERE id = '131f4df3-d55d-4263-90de-12df4aaeb559' AND curation_tier = 'archive';
-- A Bag of Marbles (2017, 7.3/6813) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '13cf685a-f9f1-4203-88fa-be26425ea7b8' AND curation_tier = 'archive';
-- The Ballad of Narayama (1983, 7.8/9789) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '13e91e46-87c4-4635-aa56-4793d48a43c1' AND curation_tier = 'archive';
-- Mr & Mme Adelman (2017, 7.3/6188) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '1567d06b-a490-4d14-9915-f13407b7f0b8' AND curation_tier = 'archive';
-- Delusions of Grandeur (1971, 7.1/8415) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '1ae97a48-994d-41ec-8259-984f39346ec4' AND curation_tier = 'archive';
-- Face to Face (1976, 7.5/6619) → core
UPDATE films SET curation_tier = 'core' WHERE id = '1b7fb381-6f4c-4875-8d3a-8b6d36f73d2c' AND curation_tier = 'archive';
-- The Family Plan (2023, 6.3/62349) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '1c589cd9-853d-4f97-af4d-91bb55e9157b' AND curation_tier = 'archive';
-- Cold Eyes (2013, 7.1/9101) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '1ca18070-bab9-4e70-a912-f605bb777cfe' AND curation_tier = 'archive';
-- Flavors of Youth (2018, 6.6/9344) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '1cf69374-a9e1-4588-90c1-bd8f968d3b90' AND curation_tier = 'archive';
-- R (2010, 7.1/5585) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '1dde7817-37ae-4d56-ac3b-d5ecfe4cb8f9' AND curation_tier = 'archive';
-- The Eight Hundred (2020, 6.7/8239) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '1e78b1d8-b260-4ea2-bb62-bfa259b3afdc' AND curation_tier = 'archive';
-- Kanal (1957, 7.9/8202) → core
UPDATE films SET curation_tier = 'core' WHERE id = '1eeecdd0-a477-472c-875e-526fe40966e6' AND curation_tier = 'archive';
-- Dr. Mabuse, the Gambler (1922, 7.8/9645) → core
UPDATE films SET curation_tier = 'core' WHERE id = '1f36b8b7-ac62-48be-acbd-17bef716b3bb' AND curation_tier = 'archive';
-- For Love and Gold (1966, 7.7/5440) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '1f4ed9a3-d2ec-4e76-b2cf-6739f4cda218' AND curation_tier = 'archive';
-- Rabid Dogs (1973, 7.4/5462) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '1fe7934b-04d2-493d-af25-a009bd86157a' AND curation_tier = 'archive';
-- On the Silver Globe (1989, 7.2/5048) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '206b3509-a1d9-4c55-a269-ce9f87cccc1c' AND curation_tier = 'archive';
-- The Old Gun (1975, 7.5/5024) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '2185f720-5a8a-453c-9810-ba23a7491858' AND curation_tier = 'archive';
-- One Piece: Stampede (2019, 7.5/9548) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '21b5214e-6055-465f-b053-3542bd7fe8cd' AND curation_tier = 'archive';
-- Nothing Left to Do But Cry (1984, 7.6/7310) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '227632a7-9936-4fdf-a42f-d86f453fa16b' AND curation_tier = 'archive';
-- Camino (2008, 7.4/5376) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '2281c3a5-1f86-4293-b7d2-7d0bdf4b9a3e' AND curation_tier = 'archive';
-- Help! I'm a Fish (2000, 6/7523) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '239caf7c-a7b4-4d1b-8aa5-ba7c5f5cfc5b' AND curation_tier = 'archive';
-- No Mercy (2010, 7.4/9896) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '251b49c2-bef5-4ba6-a673-0cf19ff7f4fd' AND curation_tier = 'archive';
-- Breakthrough (2019, 6.3/11613) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '258ac055-79e6-4dd0-9221-76f330abb047' AND curation_tier = 'archive';
-- Terrifier 3 (2024, 6.2/61278) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '291e176c-9fac-48f1-9e6f-ff16a11fd830' AND curation_tier = 'archive';
-- Pandora (2016, 6.7/8873) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '2cea9ff1-1a57-4bc6-89b0-e77f5da023de' AND curation_tier = 'archive';
-- Kung Fu Panda 4 (2024, 6.3/78494) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '2d636056-f749-4909-b04a-812d2d7aaebb' AND curation_tier = 'archive';
-- Marry My Dead Body (2023, 7/7268) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '2d890ab0-9535-4b46-947d-ff27ddd8deb4' AND curation_tier = 'archive';
-- 100 Meters (2016, 7.5/7138) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '2e2087d9-5726-4ac4-ac44-921a623638b3' AND curation_tier = 'archive';
-- The Tunnel to Summer, the Exit of Goodbyes (2022, 7.1/6110) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '2ed8bcd2-11a4-40c4-99ca-ffbcbf6fe8ad' AND curation_tier = 'archive';
-- Dying to Survive (2018, 7.8/9024) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '2ee4fbd3-df0e-4c67-b71c-5e28a2d29876' AND curation_tier = 'archive';
-- Floating Weeds (1959, 7.9/9697) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '2fade49f-c99e-4b51-ba44-3eb8ed5928d1' AND curation_tier = 'archive';
-- Warsaw 44 (2014, 6.6/7180) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '31b9a72f-4123-495b-9d59-78148eb8cf68' AND curation_tier = 'archive';
-- The Hourglass Sanatorium (1973, 7.4/5614) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '31d43963-4e9a-4bf0-af98-1c7e03be69b0' AND curation_tier = 'archive';
-- Le Deuxième Souffle (1966, 7.9/7129) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '325b7736-a409-44e7-a980-8ae937347b45' AND curation_tier = 'archive';
-- The Roundup: No Way Out (2023, 6.6/8307) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '33043831-132c-45d1-a340-6e4a2f53e631' AND curation_tier = 'archive';
-- Swept Away (1974, 7.5/7325) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '3308961b-d138-4a46-853e-c32190bc4069' AND curation_tier = 'archive';
-- Daybreak (1939, 7.7/8488) → core
UPDATE films SET curation_tier = 'core' WHERE id = '33cb1a29-7c4f-4dc8-b13e-42f5f2bd2233' AND curation_tier = 'archive';
-- The Drama (2026, 7.5/26572) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '340be1ee-6e12-4713-873a-9e43bb85b7e4' AND curation_tier = 'archive';
-- Officer Black Belt (2024, 6.9/9895) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '363e0143-a063-412a-8cc6-6bdc3a0fd7fd' AND curation_tier = 'archive';
-- The Small Town (1997, 7/7030) → core
UPDATE films SET curation_tier = 'core' WHERE id = '36d84ff7-717d-4f55-8788-1958c2310607' AND curation_tier = 'archive';
-- Mulan: Rise of a Warrior (2009, 6.6/7140) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '36ddb864-8233-4c68-9e82-6c65768d363b' AND curation_tier = 'archive';
-- Love (2015, 6.1/73447) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '38198cf8-4c06-4ff9-9711-e0e6f595eedb' AND curation_tier = 'archive';
-- The Human Condition II: Road to Eternity (1959, 8.5/8444) → core
UPDATE films SET curation_tier = 'core' WHERE id = '38eb4d5b-00b7-433b-b642-9cb67cb1495f' AND curation_tier = 'archive';
-- Ugly, Dirty and Bad (1976, 7.7/9294) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '39e94ac2-ec88-48b5-89b9-deb994da1de5' AND curation_tier = 'archive';
-- Gertrud (1964, 7.3/6939) → core
UPDATE films SET curation_tier = 'core' WHERE id = '3c3dec29-f881-4d47-8908-b4c126faa6d0' AND curation_tier = 'archive';
-- Elisa & Marcela (2019, 6.6/6067) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '3e09ef5f-1aac-4802-a70b-a816721452a4' AND curation_tier = 'archive';
-- Sawdust and Tinsel (1953, 7.4/7548) → core
UPDATE films SET curation_tier = 'core' WHERE id = '3efe73f1-c2df-4494-adc3-de157d8fc37d' AND curation_tier = 'archive';
-- Night Is Short, Walk On Girl (2017, 7.5/7232) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '3f06d748-214f-4aeb-8049-7d35bb24d1db' AND curation_tier = 'archive';
-- Creation of the Gods I: Kingdom of Storms (2023, 6.7/6419) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '3f8b189a-6c42-4f4c-84e0-c48056c0ed77' AND curation_tier = 'archive';
-- Gods (2014, 7.6/7875) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '3fab178d-ec74-42ca-b90e-bc2ba784e6ae' AND curation_tier = 'archive';
-- Ride On (2023, 6.3/7346) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '3fe2daec-c25a-4094-af04-e685d3e92300' AND curation_tier = 'archive';
-- The Idiot (1951, 7.1/5828) → core
UPDATE films SET curation_tier = 'core' WHERE id = '3ff8668c-271b-4721-bf87-f2232f014dc3' AND curation_tier = 'archive';
-- Camera Buff (1979, 7.8/8595) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '423b2b6c-a071-484b-8076-d32575e5cf03' AND curation_tier = 'archive';
-- Belladonna of Sadness (1973, 7.3/9279) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '439648cf-3cdc-41cf-af7b-abe74c3c51da' AND curation_tier = 'archive';
-- Fabricated City (2017, 6.8/6938) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '448ac33b-af43-48cf-8ba8-882aaebc4e71' AND curation_tier = 'archive';
-- The Wrecking Crew (2026, 6.4/45325) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '44e59f0a-b5bf-4a8b-bfe1-f35f49046550' AND curation_tier = 'archive';
-- Mike & Nick & Nick & Alice (2026, 6.2/15353) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '453a4df3-f613-4846-af6e-494da889194d' AND curation_tier = 'archive';
-- Cold Storage (2026, 6.1/15845) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '456355cc-a774-45b6-beac-91dfac23769e' AND curation_tier = 'archive';
-- Mad Detective (2007, 7.1/8274) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '46dfe99d-e448-44e9-9c11-4ea02a162221' AND curation_tier = 'archive';
-- Dance of the Forty One (2020, 6.8/5847) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '47292992-af1b-4e47-a193-3e2e09534c16' AND curation_tier = 'archive';
-- Girl in the Basement (2021, 6.3/17040) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '4a7a6058-1286-4ccc-8e59-664428beb693' AND curation_tier = 'archive';
-- Exit 8 (2025, 6.4/14034) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '4a9b5c77-0ee4-4c03-9633-86de7abb434c' AND curation_tier = 'archive';
-- The Tiger (2015, 7.2/7416) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '4bf342e3-a060-4d45-a074-374a14c22759' AND curation_tier = 'archive';
-- Checkered Ninja (2018, 7.1/6636) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '4d48ec5c-aa25-457e-b924-f1b878bb7d66' AND curation_tier = 'archive';
-- Mercy (2026, 6.2/56372) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '4dfaef83-9d19-4a05-ad92-b0d44e8bd411' AND curation_tier = 'archive';
-- They Will Kill You (2026, 6.5/8025) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '4efba55a-cc49-4baf-81a2-c5d6ebf22c15' AND curation_tier = 'archive';
-- An Elephant Sitting Still (2018, 7.8/9155) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '4f09e39f-f9b6-4514-9f89-1ff35090ddf2' AND curation_tier = 'archive';
-- Operation Red Sea (2018, 6.6/8539) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '5004246c-99a0-4289-8d68-b8259bd88d2e' AND curation_tier = 'archive';
-- Boys Don't Cry (2000, 7.6/7652) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '51634919-cb7d-4489-8dd4-e2b148a811ee' AND curation_tier = 'archive';
-- My Friends (1975, 7.9/8338) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '52ab300b-ead5-45c9-b84b-7f389ff566d5' AND curation_tier = 'archive';
-- Don't Blame the Kid (2016, 6.6/5770) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '53d95dda-5da5-4cc5-8c7b-aa50fcaca2d4' AND curation_tier = 'archive';
-- Humanist Vampire Seeking Consenting Suicidal Person (2023, 7/8736) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '56094c0d-c1ad-415d-9f57-46c94d8d2ed2' AND curation_tier = 'archive';
-- Black Phone 2 (2025, 6.1/58077) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '56438f31-e5c3-4268-857f-5033ec1e6958' AND curation_tier = 'archive';
-- Welcome to Dongmakgol (2005, 7.6/7659) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '574665b0-e192-4152-a61b-bbef026047ab' AND curation_tier = 'archive';
-- Italian Race (2016, 7.2/5753) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '59c77758-5e6e-47b4-8ddd-3d5ff6203a61' AND curation_tier = 'archive';
-- The Conjuring: Last Rites (2025, 6.2/98159) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '5b3f9148-9542-4c95-b9c4-f6ca05df456b' AND curation_tier = 'archive';
-- Pirates (1986, 6/9984) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '5b937f7a-f68a-40f3-8481-371c538f69e1' AND curation_tier = 'archive';
-- Pippi in the South Seas (1970, 6.9/5990) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '5f99756e-d93c-4c31-ba5c-73534a1b6f73' AND curation_tier = 'archive';
-- The Lower Depths (1957, 7.2/6244) → core
UPDATE films SET curation_tier = 'core' WHERE id = '600783fc-7908-42d3-afa7-4a1a01ce14a8' AND curation_tier = 'archive';
-- Fantozzi: White Collar Blues (1975, 7.8/7159) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '61ed41ea-7f39-4519-a196-0474ce90c33b' AND curation_tier = 'archive';
-- Topaz (1969, 6.2/20404) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '6243e1b9-0a2a-4a75-8965-9b2cb00828a2' AND curation_tier = 'archive';
-- The Summit of the Gods (2021, 7.5/9339) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '634fec75-7e9d-4c85-b501-5b38bf711f4a' AND curation_tier = 'archive';
-- Letters to Santa (2011, 7.2/5024) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '63a7355b-3f9a-441b-baa4-32107ada8c11' AND curation_tier = 'archive';
-- The Serpent's Egg (1977, 6.6/6864) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '63d9c9b3-b1a6-42a1-8f57-aaa4de3c86a9' AND curation_tier = 'archive';
-- How I Became a Gangster (2019, 6.9/5506) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '65c8ae38-b7b3-42da-8a1b-0d910a18dc7c' AND curation_tier = 'archive';
-- Souleymane's Story (2024, 7.6/6945) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '6664bbd8-32e6-474b-afc3-de96e34c3dec' AND curation_tier = 'archive';
-- Bad Cat (2016, 7/9183) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '66bc13f9-b1f6-4088-aa20-134a25bcf696' AND curation_tier = 'archive';
-- Be With You (2018, 7.7/8076) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '670e0ae6-d340-4b36-b0e1-51ba97803d6d' AND curation_tier = 'archive';
-- Moonwalker (1988, 6.1/19527) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '681551fe-6bcf-4533-ac44-e5c8c8dcf3cf' AND curation_tier = 'archive';
-- Violet Evergarden: Eternity and the Auto Memory Doll (2019, 7.5/7479) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '68435bdd-498f-4339-8320-b4d2c8623dc5' AND curation_tier = 'archive';
-- Unstoppable (2018, 6.6/6637) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '6b1ac344-5857-4a5a-851b-d4f68deb053e' AND curation_tier = 'archive';
-- Becoming Astrid (2018, 7.1/7466) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '6b85228f-bb02-4e6c-a065-5180bc1953a7' AND curation_tier = 'archive';
-- The Sucker (1965, 7.3/8596) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '6c2fe8ed-61fd-4761-bd0a-2083c6784919' AND curation_tier = 'archive';
-- The Yin-Yang Master: Dream of Eternity (2020, 6.4/5770) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '6db5a6cc-56d3-4978-b0b2-51b49910bfab' AND curation_tier = 'archive';
-- Radical (2023, 7.8/7330) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '6dc8d982-a1a8-4a9a-8ef7-e18d6f46dceb' AND curation_tier = 'archive';
-- Lone Wolf and Cub: Sword of Vengeance (1972, 7.7/9100) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '705b691c-1e4f-45ff-9da7-ccfce2fce23d' AND curation_tier = 'archive';
-- #Alive (2020, 6.3/52542) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '70ae93d3-166a-4239-aff3-c10dfe0bc243' AND curation_tier = 'archive';
-- The Swindle (1955, 7.5/7484) → core
UPDATE films SET curation_tier = 'core' WHERE id = '71c28f3b-7375-4353-99c9-df0957a1e034' AND curation_tier = 'archive';
-- Godland (2022, 7.1/8775) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '746c36d4-da4f-4231-92f0-803dedda19a0' AND curation_tier = 'archive';
-- Your Name Engraved Herein (2020, 7.3/8433) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '7558f34a-eca9-4e8d-9191-a664519f9fa6' AND curation_tier = 'archive';
-- Godzilla vs. Biollante (1989, 6.5/7827) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '76029869-eb49-40a9-9d6e-5de8e054c294' AND curation_tier = 'archive';
-- Shelter (2026, 6.1/25305) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '77e564c5-292c-4402-bd29-ece23e7a35e1' AND curation_tier = 'archive';
-- Samurai I: Musashi Miyamoto (1954, 7.4/9728) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '7805287d-0bca-4877-acc5-771819ca1e2c' AND curation_tier = 'archive';
-- One Piece Film: Strong World (2009, 7.4/8082) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '78631283-1fcd-437a-955e-9d4dd97c19ae' AND curation_tier = 'archive';
-- The Human Condition III: A Soldier's Prayer (1961, 8.8/8466) → core
UPDATE films SET curation_tier = 'core' WHERE id = '788eda87-9875-417c-a7be-65e5d2d52e51' AND curation_tier = 'archive';
-- My Blind Date with Life (2017, 7.1/5874) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '789fe274-70c1-49f8-9dc3-bbcb91c02228' AND curation_tier = 'archive';
-- Dodes'ka-den (1970, 7.3/8176) → core
UPDATE films SET curation_tier = 'core' WHERE id = '7a188483-e5e7-4fa7-ae2f-e51998460fb3' AND curation_tier = 'archive';
-- Sissi: The Young Empress (1956, 6.7/7967) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '7c1d6129-e523-40a4-9b9c-be06e1a7f9be' AND curation_tier = 'archive';
-- The Super Mario Galaxy Movie (2026, 6.4/33056) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '7c1f2ec5-a3d9-4972-9393-ecb65f97a2d1' AND curation_tier = 'archive';
-- Sami Blood (2017, 7.3/8595) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '7c7a0e6d-dbd1-43b8-ac51-f834d948833e' AND curation_tier = 'archive';
-- French Fried Vacation 2 (1979, 7.4/9323) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '7c9e8338-e918-4355-98ba-f991f8c4a1e6' AND curation_tier = 'archive';
-- Emancipation (2022, 6.3/30693) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '7dc07448-582f-4588-b525-25ce3f8e4db4' AND curation_tier = 'archive';
-- The Inquisitor (1981, 7.6/6405) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '7dc18fc7-27ab-4dcc-a4c2-a4339cfd4915' AND curation_tier = 'archive';
-- One Hundred Steps (2000, 7.5/6631) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '7e400d42-cebc-4554-b708-b6f1dbfbdb56' AND curation_tier = 'archive';
-- Touchez Pas au Grisbi (1954, 7.7/9292) → core
UPDATE films SET curation_tier = 'core' WHERE id = '801dff16-4f26-4952-9664-57d606e26797' AND curation_tier = 'archive';
-- Paisan (1946, 7.6/9963) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '806c845d-a95f-4b83-8b56-b6b3e0c1c832' AND curation_tier = 'archive';
-- The House with Laughing Windows (1976, 7/6457) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '81a3af96-bb75-4f12-9143-d39c2ac0275e' AND curation_tier = 'archive';
-- Feel the Beat (2020, 6.3/14201) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '81d89861-f723-45c7-af78-d2a2159e965a' AND curation_tier = 'archive';
-- Jamaica Inn (1939, 6.3/11887) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '827aa7d3-0030-4984-b4f4-85f7adb3c521' AND curation_tier = 'archive';
-- Black Clover: Sword of the Wizard King (2023, 7.4/9611) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '837397a9-e4bf-4755-a462-9e7455fd0563' AND curation_tier = 'archive';
-- Godzilla, Mothra and King Ghidorah: Giant Monsters All-Out Attack (2001, 7/7832) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '837fc5de-577d-48a6-b190-8675518d72ff' AND curation_tier = 'archive';
-- We All Loved Each Other So Much (1974, 8/7829) → core
UPDATE films SET curation_tier = 'core' WHERE id = '85b3834d-ddd1-4dc7-a1e0-f51c6be29d26' AND curation_tier = 'archive';
-- Napoleon (1927, 8.2/9108) → core
UPDATE films SET curation_tier = 'core' WHERE id = '8633326f-b88a-4d67-aa69-cb2a46d9bb42' AND curation_tier = 'archive';
-- Ask Me If I'm Happy (2000, 7.1/9114) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '86d33516-6d93-4444-89f2-a1536cd62e82' AND curation_tier = 'archive';
-- Play (2011, 7.1/6915) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '8846082b-127c-4e5a-b604-3c8493d23fd5' AND curation_tier = 'archive';
-- Ginger and Fred (1986, 7.2/5724) → core
UPDATE films SET curation_tier = 'core' WHERE id = '8846ea90-ecc7-4e49-af0e-b1a97b43f245' AND curation_tier = 'archive';
-- Godzilla vs. Destoroyah (1995, 6.9/7978) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '8a69d803-c409-4ad1-a325-0495564d6005' AND curation_tier = 'archive';
-- The Beauty Inside (2015, 7.3/8636) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '8ac2a36e-13e9-42ca-b60d-f06279e761c3' AND curation_tier = 'archive';
-- I Am a Hero (2016, 6.7/8501) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '8d2811e8-b8a3-4431-935b-b224d6ba829f' AND curation_tier = 'archive';
-- Miracle at St. Anna (2008, 6.1/19697) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '9050bdf5-48fc-4434-87b8-198839fe006a' AND curation_tier = 'archive';
-- The Last Family (2016, 7.4/5216) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '90a32829-c7fe-474d-8391-3823cb42d0de' AND curation_tier = 'archive';
-- Under the Same Moon (2007, 7.3/7801) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '90a41f20-5448-4542-89fd-2209644a2a0d' AND curation_tier = 'archive';
-- The Running Man (2025, 6.4/92947) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '912dd8c0-6c03-44d9-b90a-3c4c08c7e459' AND curation_tier = 'archive';
-- The Truth (1960, 7.6/5369) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '9194bc94-32f1-42d0-a95f-b1416837289b' AND curation_tier = 'archive';
-- No Game No Life: Zero (2017, 7.3/5305) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '919fc483-8cd8-43c8-ad7c-727cddd8cc75' AND curation_tier = 'archive';
-- Made in Abyss: Dawn of the Deep Soul (2020, 8/7227) → core
UPDATE films SET curation_tier = 'core' WHERE id = '91bf3a6f-2f96-4f4d-9f6c-84e14d029cc3' AND curation_tier = 'archive';
-- The King and the Mockingbird (1980, 7.7/5936) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '926c0560-62c4-4bb7-a6d0-8318ba08c532' AND curation_tier = 'archive';
-- I Spit on Your Grave (2010, 6.2/99752) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '92c61fd6-bedb-46dc-9fbc-81496f3d856e' AND curation_tier = 'archive';
-- Crooks in Clover (1963, 7.7/6946) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '94260daf-36be-4e59-8f19-d5fea3c2bf28' AND curation_tier = 'archive';
-- EXIT (2019, 7/8401) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '94e19d34-73ff-42fa-afc1-730c28e243b2' AND curation_tier = 'archive';
-- The Pig, the Snake and the Pigeon (2023, 7.3/8391) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '94e8c5cc-2f73-4fb5-a497-6c4be8da12d9' AND curation_tier = 'archive';
-- Millennium Mambo (2001, 7/8297) → core
UPDATE films SET curation_tier = 'core' WHERE id = '95bd27a2-6650-4964-8b69-c6447d6576ca' AND curation_tier = 'archive';
-- The Killer (2022, 6.7/5362) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '97912570-8927-4a21-b8f1-121026d5cf5a' AND curation_tier = 'archive';
-- Sniper: The White Raven (2022, 6.4/7730) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '9910804b-8e7e-4da4-bdf6-55fd28d58d59' AND curation_tier = 'archive';
-- The Seven Deadly Sins: Prisoners of the Sky (2018, 7/5966) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '99fcf6c8-b173-43b5-9da5-ab1cfc900b3d' AND curation_tier = 'archive';
-- Dracula (2025, 6.2/34913) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '9c15981f-7f81-4daf-9cfb-9041b392480a' AND curation_tier = 'archive';
-- Late Shift (2025, 7.7/8557) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '9c983c98-1419-43d5-9b16-74a1b7588dfe' AND curation_tier = 'archive';
-- No End (1985, 7.3/6146) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '9d2a1457-39bf-4454-85d0-ac82e05c9127' AND curation_tier = 'archive';
-- Room in Rome (2010, 6/27407) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '9d2ac55b-4be1-406a-aa3f-c112e32a9ea8' AND curation_tier = 'archive';
-- Big Fish & Begonia (2016, 7/7430) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '9e3f2256-5ce9-4a2d-aafc-5ebfa87168f4' AND curation_tier = 'archive';
-- The Round Up (2010, 7/9559) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = '9fb78847-79a5-4342-9b76-2945ecc7cd28' AND curation_tier = 'archive';
-- Early Summer (1951, 8.1/9910) → core
UPDATE films SET curation_tier = 'core' WHERE id = '9fe39854-4a0c-4398-95c4-abec922e1335' AND curation_tier = 'archive';
-- The Tree of Wooden Clogs (1978, 7.8/7136) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'a056fc8c-4a52-486c-8409-b3099c2aa53c' AND curation_tier = 'archive';
-- The Spy Gone North (2018, 7.4/7213) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'a0b32c7e-3344-4961-aca7-cf3d4bf4a2da' AND curation_tier = 'archive';
-- My Hero Academia: World Heroes' Mission (2021, 7/7254) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'a123410d-e0fb-48c6-a4ee-a5a715a13cf1' AND curation_tier = 'archive';
-- I Can Quit Whenever I Want (2014, 7/9764) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'a14861e1-4635-4e9f-89a9-ecd515dfcc09' AND curation_tier = 'archive';
-- Summer Interlude (1951, 7.5/7113) → core
UPDATE films SET curation_tier = 'core' WHERE id = 'a299bf4e-7dc6-4af3-8979-f602ebc9289c' AND curation_tier = 'archive';
-- The Children's Train (2024, 7.4/8916) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'a521ad34-9fb2-4d7d-89c5-40259b937bd5' AND curation_tier = 'archive';
-- To Each His Own Cinema (2007, 6.7/5580) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'a5f05571-7b76-4188-91ee-8d00b2336bf0' AND curation_tier = 'archive';
-- Operation Mekong (2016, 6.5/5663) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'a76f8bfe-9254-49c8-be3a-1165a605adfc' AND curation_tier = 'archive';
-- The White Sheik (1952, 7.2/7087) → core
UPDATE films SET curation_tier = 'core' WHERE id = 'a7f601ea-635b-458f-bff7-d26641508cad' AND curation_tier = 'archive';
-- The Bible: In the Beginning... (1966, 6.2/6623) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'a834e817-5a12-4cb4-a44a-8f19ebe967b1' AND curation_tier = 'archive';
-- Unlocked (2023, 6.4/12243) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'a8882105-8999-4bf2-9217-d4f83f893bdf' AND curation_tier = 'archive';
-- Under Capricorn (1949, 6.2/8561) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'a9c6ed4b-aa2f-4453-880f-ffda4688a99f' AND curation_tier = 'archive';
-- Ready or Not: Here I Come (2026, 6.6/30168) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'a9d8e55d-2586-4d60-bd1e-96907e9fa758' AND curation_tier = 'archive';
-- April 9th (2015, 6.6/6624) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'ab941b87-649f-49d1-9779-a17c1c55dd3b' AND curation_tier = 'archive';
-- The Disappearance of Haruhi Suzumiya (2010, 8/8722) → core
UPDATE films SET curation_tier = 'core' WHERE id = 'ac0f6c20-c4ab-436d-af4f-94016f84a42a' AND curation_tier = 'archive';
-- Red Shoes and the Seven Dwarfs (2019, 6.5/6372) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'acfa8601-1b9b-497d-87f1-fc2598761826' AND curation_tier = 'archive';
-- Sanshiro Sugata (1943, 6.7/6102) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'adf9adf2-2723-441b-818a-b4a76fd70cce' AND curation_tier = 'archive';
-- Bitter Rice (1949, 7.6/5496) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'af3bc99e-4aab-4797-b597-60fdec3e62c7' AND curation_tier = 'archive';
-- The Roundup: Punishment (2024, 6.6/6461) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'b1337879-10dd-46e0-95a5-4de16a9e5597' AND curation_tier = 'archive';
-- A Werewolf Boy (2012, 7.2/9690) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'b1d84ddf-e137-4fc8-be2c-d4142f826e5e' AND curation_tier = 'archive';
-- A Fortunate Man (2018, 7.2/7805) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'b21671eb-f596-4480-8981-0be6043cf51b' AND curation_tier = 'archive';
-- That's Life (1998, 7/5640) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'b569053a-f837-44a0-a1e8-435786b41dcb' AND curation_tier = 'archive';
-- Rhapsody in August (1991, 7.2/8083) → core
UPDATE films SET curation_tier = 'core' WHERE id = 'b6b8df2a-9e00-4c86-8a9c-f2e522788fb7' AND curation_tier = 'archive';
-- Last Train from Gun Hill (1959, 7.3/9071) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'b979604c-f128-4efb-83d9-46e20a0f2d73' AND curation_tier = 'archive';
-- Maelström (2000, 6.7/7502) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'ba2ce628-aa9f-4bac-aa19-d94fade0752f' AND curation_tier = 'archive';
-- Honey (2010, 7.1/7688) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'ba4aa167-c547-4140-8bc4-572df332f977' AND curation_tier = 'archive';
-- From the Life of the Marionettes (1980, 7.2/5046) → core
UPDATE films SET curation_tier = 'core' WHERE id = 'bad75619-777e-42be-a91d-0c6b51c300c6' AND curation_tier = 'archive';
-- Sissi: The Fateful Years of an Empress (1957, 6.6/6354) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'bca12e40-1646-49df-8a5a-ed3ec89ce1d3' AND curation_tier = 'archive';
-- Magical Girl (2014, 7.2/7754) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'bdb0eb6e-0811-4422-a801-7f04603a3922' AND curation_tier = 'archive';
-- Neon Genesis Evangelion: Death and Rebirth (1997, 7.2/16346) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'be8a8274-06f8-467a-a2d2-db098bb7c577' AND curation_tier = 'archive';
-- 71: Into the Fire (2010, 7.3/6092) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'bf2504a7-4310-4012-9df2-cfc82391370d' AND curation_tier = 'archive';
-- My Fault: London (2025, 6.2/13668) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'bf2d5bfc-89ca-44d1-b7e0-313fbbccd584' AND curation_tier = 'archive';
-- The Emigrants (1971, 8/7892) → core
UPDATE films SET curation_tier = 'core' WHERE id = 'c05e141f-c1eb-4273-b8b8-5a5e50eb7562' AND curation_tier = 'archive';
-- Madadayo (1993, 7.3/6317) → core
UPDATE films SET curation_tier = 'core' WHERE id = 'c097be44-8a9a-4d7a-a75a-091f0412ef7f' AND curation_tier = 'archive';
-- Where Hands Touch (2018, 6.6/6216) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'c0ae5161-7861-4263-9b0b-5750a6ee86ba' AND curation_tier = 'archive';
-- Obsession (1944, 7.6/8457) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'c0e34762-8d7d-4f3b-a51d-9081c0437ec1' AND curation_tier = 'archive';
-- Black Dog (2024, 7.2/5685) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'c11b222b-fac5-410a-baf8-08fab6ebed3d' AND curation_tier = 'archive';
-- Miracle in Milan (1951, 7.6/8854) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'c234693e-98aa-473c-9f5f-60f6376dc8f4' AND curation_tier = 'archive';
-- Oscar (1967, 7.5/8267) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'c24791be-05f1-48d8-bfa7-a2e2263a341c' AND curation_tier = 'archive';
-- Mountains May Depart (2015, 6.9/6975) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'c43862f3-4a9d-44c0-8fed-2ed51484c5b4' AND curation_tier = 'archive';
-- White Snake (2019, 7/6307) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'c473662c-8e7f-426c-a00f-25fa482e650f' AND curation_tier = 'archive';
-- The Wonderful Story of Henry Sugar and Three More (2024, 7.1/8675) → core
UPDATE films SET curation_tier = 'core' WHERE id = 'c519ef4c-6301-45c1-8bc3-012f8c4fbe76' AND curation_tier = 'archive';
-- Scenes from a Marriage (1974, 8.3/9576) → core
UPDATE films SET curation_tier = 'core' WHERE id = 'c53664d2-7fa8-480d-9957-73c305ea4276' AND curation_tier = 'archive';
-- Spirits of the Dead (1968, 6.4/7122) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'c599c165-1f31-414c-8dbd-ac280420e67a' AND curation_tier = 'archive';
-- No Tears for the Dead (2014, 6.7/7761) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'c6c5fb21-50ff-40d5-873e-302eab18bae4' AND curation_tier = 'archive';
-- Assassination (2015, 7.2/8447) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'c7329bf7-925f-46f0-bb0a-dad21061d52b' AND curation_tier = 'archive';
-- Nobody 2 (2025, 6.3/89019) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'cb235f44-6062-43db-8396-cbe61db95f0f' AND curation_tier = 'archive';
-- Senso (1954, 7.4/9511) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'cb5c6eb1-04d7-46e2-a95e-addd78a251cd' AND curation_tier = 'archive';
-- HAIKYU!! The Dumpster Battle (2024, 7.7/6882) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'cd5d8659-d54e-47d8-941d-9c34f5a51415' AND curation_tier = 'archive';
-- Maborosi (1995, 7.5/7954) → core
UPDATE films SET curation_tier = 'core' WHERE id = 'cdd0eeb8-fc83-48a9-8475-6ed46894c05c' AND curation_tier = 'archive';
-- Monkey King: Hero Is Back (2015, 6.7/5069) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'ce80b119-3efd-4172-8684-cdc16955e50c' AND curation_tier = 'archive';
-- Le Notti Bianche (1957, 7.8/9351) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'cebb3fab-8f9d-4046-9ead-e03a4d0d4209' AND curation_tier = 'archive';
-- Reign of Assassins (2010, 6.8/9504) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'cf0c6e0e-f3dc-4f52-9e77-f1bda57f0b67' AND curation_tier = 'archive';
-- The Attorney (2013, 7.7/8421) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'cfbd3eb4-a80c-4b4b-9740-51b21a5d97cd' AND curation_tier = 'archive';
-- Life in a Year (2020, 6.2/11138) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'd0f83a8d-5353-434e-be27-3b4a1c9acc7e' AND curation_tier = 'archive';
-- The Battleship Island (2017, 7.1/9214) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'd290289f-a9f5-4811-aa0d-8739ab57399d' AND curation_tier = 'archive';
-- Only You (2014, 7.3/6657) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'd2983991-79b5-4ea0-aafe-dd71265d1576' AND curation_tier = 'archive';
-- All My Life (2020, 6.3/6964) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'd3b2de76-f579-4de1-b275-b0b59beca885' AND curation_tier = 'archive';
-- So Long, My Son (2019, 7.7/5907) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'd5dad7d7-e1c1-4b4e-a088-61a0a4679195' AND curation_tier = 'archive';
-- Coming Home (2014, 7.2/7035) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'd73783f8-fec8-465c-91c5-915cfd9d40ca' AND curation_tier = 'archive';
-- Barefoot Gen (1983, 8/9988) → core
UPDATE films SET curation_tier = 'core' WHERE id = 'd7e06127-f8e0-419a-b7b3-aed90b37ceaa' AND curation_tier = 'archive';
-- Freakier Friday (2025, 6.2/38258) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'd8b36078-715a-4837-bd12-9055a9e6e11b' AND curation_tier = 'archive';
-- Murder She Said (1961, 7.3/8830) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'da6eb4dd-b0e8-4871-86e6-b2fb04e586fd' AND curation_tier = 'archive';
-- That Man from Rio (1964, 7/6797) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'db12370a-d35f-4cf1-b77b-6609bd90da4a' AND curation_tier = 'archive';
-- The Voyeurs (2021, 6.1/44090) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'db8ae63e-ef64-47a8-a437-655d62cc6684' AND curation_tier = 'archive';
-- KONOSUBA – God's blessing on this wonderful world! Legend of Crimson (2019, 7.8/6988) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'df45d89f-f299-487d-b70f-a68c536f5016' AND curation_tier = 'archive';
-- A Town Called Panic (2009, 7.4/9187) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'df8e75ee-1fb0-4f88-9978-fd62d8a59320' AND curation_tier = 'archive';
-- Comidark Films: In Between (2019, 6.4/13837) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'dfc688d6-10b9-4e70-b6fe-5c373c0221e9' AND curation_tier = 'archive';
-- Killer (1997, 7.5/8646) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'e28ddb48-2732-4598-8a29-a2157a68be11' AND curation_tier = 'archive';
-- Othello (1951, 7.5/9676) → core
UPDATE films SET curation_tier = 'core' WHERE id = 'e2f1bd3d-a52d-41ed-b82d-8de5e2b3debf' AND curation_tier = 'archive';
-- Don't Be Bad (2015, 7.1/5203) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'e329469f-4a60-4177-87dc-cf546267e317' AND curation_tier = 'archive';
-- The Perfect Dictatorship (2014, 7.2/6315) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'e34d532e-cc6e-4470-a4fa-1e2a07c8589e' AND curation_tier = 'archive';
-- Miraculous: Ladybug & Cat Noir, The Movie (2023, 6.1/8084) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'e414bbb7-6311-4fa5-9fd6-1f328e37415d' AND curation_tier = 'archive';
-- Colors of Evil: Red (2024, 6.4/7707) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'e41ed28b-15e4-4687-854d-353f5d0ee736' AND curation_tier = 'archive';
-- Teddy Bear (1981, 8.2/6846) → core
UPDATE films SET curation_tier = 'core' WHERE id = 'e42bccfb-078a-49b3-a75a-93c4325e66a1' AND curation_tier = 'archive';
-- Stromboli (1950, 7.2/8233) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'e5a3c4dd-0abf-45c5-8035-60ef554f7b8e' AND curation_tier = 'archive';
-- Herod's Law (1999, 7.8/7295) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'e73feb4f-7dbd-480b-ad22-2a416eb60fe5' AND curation_tier = 'archive';
-- War Machine (2026, 6.3/86956) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'e78929bb-6fa6-423c-9dd1-e741edecfd7a' AND curation_tier = 'archive';
-- Nowhere (2023, 6.3/48244) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'e7c7ce77-d2e9-41a1-93ee-a747fab9b0dd' AND curation_tier = 'archive';
-- The Swordsman (2020, 6.8/6302) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'e81567ac-cde0-4c0b-be29-2c76507277d7' AND curation_tier = 'archive';
-- Bellissima (1952, 7.7/5518) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'e952464c-1e4d-4451-90a4-dfd757414a25' AND curation_tier = 'archive';
-- The Silent Revolution (2018, 7.4/6394) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'e9ebe147-2b31-4e80-9d8a-d8454dcbd5d5' AND curation_tier = 'archive';
-- Tune in for Love (2019, 7.1/6535) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'ea6c3a14-68bf-4a53-8afe-e356e5008ea1' AND curation_tier = 'archive';
-- The Shadow's Edge (2025, 7.1/8806) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'ec585efd-cbbe-4dac-a6b3-d2ba3976002f' AND curation_tier = 'archive';
-- Arco (2025, 7.3/7143) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'ed108e6b-1626-47b7-bfd1-cbb399ca01d5' AND curation_tier = 'archive';
-- Sword Art Online the Movie: Ordinal Scale (2017, 7.3/9966) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'ed756f87-3d74-4c3f-a603-7acc801589d7' AND curation_tier = 'archive';
-- Naruto Shippuden the Movie (2007, 6.7/5447) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'ee79942f-a0b8-4a98-af96-6aa72330444c' AND curation_tier = 'archive';
-- The Way Home (2002, 7.7/6220) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'eed542f8-994a-46df-a615-5a5207ae5ee6' AND curation_tier = 'archive';
-- Stand by Me Doraemon 2 (2020, 7.5/5631) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'ef5599f9-bd6f-4612-8bd7-38f75d1fb07f' AND curation_tier = 'archive';
-- Pippi Longstocking (1969, 7/5698) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'efae869a-f06c-4a26-86b9-ee54e5d640c3' AND curation_tier = 'archive';
-- Casque d'Or (1952, 7.6/6491) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'f01f0f9d-3764-4497-9119-2001890e9d41' AND curation_tier = 'archive';
-- Bad Seeds (2018, 7.2/6721) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'f21b8b56-61f5-4f15-a712-b9d3b8efe8b9' AND curation_tier = 'archive';
-- Counterattack (2025, 6/5794) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'f2cff521-349b-4712-b5c9-541b5a50ec93' AND curation_tier = 'archive';
-- Scent of a Woman (1974, 7.5/5485) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'f4a7b9c0-f617-4a43-9625-7819d3e01df0' AND curation_tier = 'archive';
-- The Witch: Part 2 - The Other One (2022, 6.3/9285) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'f6b353bf-b61d-4eac-be05-a05ab9a45258' AND curation_tier = 'archive';
-- "Wuthering Heights" (2026, 6.2/57394) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'f744f73a-70ba-46d1-9459-9f4cdcf17c12' AND curation_tier = 'archive';
-- How to Have Sex (2023, 6.4/22391) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'f75c5819-077f-4fef-aab0-0dc0d6d42aca' AND curation_tier = 'archive';
-- With Fire and Sword (1999, 7/5521) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'f76c6fa2-d04c-419c-bae7-5cd8d472e223' AND curation_tier = 'archive';
-- A Scene at the Sea (1991, 7.5/7069) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'f78c275d-4869-4c2f-9415-170ad247c02d' AND curation_tier = 'archive';
-- Heidi (2015, 7.4/8220) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'f78de828-e62e-4cec-a23e-f3e67087dd5e' AND curation_tier = 'archive';
-- Kuroneko (1968, 7.7/9798) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'f7d4c3e7-7362-4118-bde8-797274c40127' AND curation_tier = 'archive';
-- The Saragossa Manuscript (1966, 7.8/6042) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'f8dc6190-af74-4f1f-8065-9ba1ebf0b1fb' AND curation_tier = 'archive';
-- Godzilla Against MechaGodzilla (2002, 6.6/6205) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'f8f6d81e-f691-4723-a4d5-0d630fb97f36' AND curation_tier = 'archive';
-- Hoppers (2026, 7.4/37622) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'fa061b3a-09f1-4a7d-acf4-2eb2fde576b5' AND curation_tier = 'archive';
-- City of Women (1980, 6.9/8513) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'fa3b7914-9b27-4cd1-a596-51e623a78523' AND curation_tier = 'archive';
-- Head Full of Honey (2014, 6.6/7572) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'fba61561-3903-4d1b-827f-d3d476207d2b' AND curation_tier = 'archive';
-- The Adventures of Prince Achmed (1926, 7.8/7520) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'fbcf31d8-8c0b-4fc4-b5ab-3908963e002c' AND curation_tier = 'archive';
-- Let Go (2024, 7/6785) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'fce4490a-640a-4c88-8cd3-57b531043d81' AND curation_tier = 'archive';
-- Hwayi: A Monster Boy (2013, 7/5646) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'fe43f9f6-ad68-4e2e-8fee-a3951819e8fe' AND curation_tier = 'archive';
-- A Touch of Zen (1970, 7.5/8143) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'ff5b4b7c-e79e-4ea2-9eb1-7e9baf4d79a2' AND curation_tier = 'archive';
-- Funeral Parade of Roses (1969, 7.7/7587) → extended
UPDATE films SET curation_tier = 'extended' WHERE id = 'ff86498c-c399-4190-955c-ea4ccea91eb5' AND curation_tier = 'archive';

-- Doğrulama: yedek 285 satır olmalı ve hiçbir film eski tier'da kalmamalı; aksi halde işlem geri alınır.
DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase1a_backup_20261031;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase1a_backup_20261031 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 285 THEN RAISE EXCEPTION 'ABORT: yedek % satır (beklenen 285)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film tier degistirmedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
