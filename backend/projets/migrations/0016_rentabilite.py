from django.db import migrations

CREATE_RENTABILITE = """
-- ============================================================
-- Table Rentabilité : champs sources (projet) + champs calculés
-- Liée aux parcelles constructibles du cadastre via id_parcelle
-- ============================================================
CREATE TABLE rentabilite (
    id                    BIGSERIAL PRIMARY KEY,
    id_parcelle           VARCHAR(20) NOT NULL,
    nom                   VARCHAR(150) NOT NULL,
    description           TEXT,
    surface_souhaitee     NUMERIC(12,2) NOT NULL,
    budget_total          NUMERIC(15,2) NOT NULL,
    prix_terrain          NUMERIC(15,2),
    nombre_unites         INTEGER,
    surface_construite    NUMERIC(12,2),
    cout_construction     NUMERIC(15,2),
    autres_charges        NUMERIC(15,2),
    prix_vente_unitaire   NUMERIC(15,2),
    revenu_estime         NUMERIC(15,2),
    date_creation         TIMESTAMPTZ NOT NULL,
    id_type               BIGINT NOT NULL,
    investisseur_id       BIGINT NOT NULL,

    investissement_total  NUMERIC(15,2),
    revenu_total          NUMERIC(15,2),
    benefice_net          NUMERIC(15,2),
    roi                   NUMERIC(6,2),
    marge                 NUMERIC(6,2),
    seuil_unites          NUMERIC(10,2),
    budget_respecte       BOOLEAN,
    complete              BOOLEAN
);

-- ============================================================
-- Vue recalculant dynamiquement les indicateurs
-- ============================================================
CREATE OR REPLACE VIEW v_rentabilite AS
SELECT
    id_parcelle,
    nom,
    prix_terrain,
    cout_construction,
    autres_charges,
    (prix_terrain + cout_construction + autres_charges) AS investissement_total,
    COALESCE(revenu_estime, prix_vente_unitaire * nombre_unites) AS revenu_total,
    (COALESCE(revenu_estime, prix_vente_unitaire * nombre_unites)
        - (prix_terrain + cout_construction + autres_charges)) AS benefice_net,
    ROUND(
        (COALESCE(revenu_estime, prix_vente_unitaire * nombre_unites)
            - (prix_terrain + cout_construction + autres_charges))
        / NULLIF(prix_terrain + cout_construction + autres_charges, 0) * 100, 2
    ) AS roi,
    (budget_total >= prix_terrain) AS budget_respecte
FROM rentabilite;

-- ============================================================
-- Données d'exemple
-- ============================================================
"""

INSERT_RENTABILITE = """
INSERT INTO rentabilite (id_parcelle, nom, description, surface_souhaitee, budget_total, prix_terrain, nombre_unites, surface_construite, cout_construction, autres_charges, prix_vente_unitaire, revenu_estime, date_creation, id_type, investisseur_id, investissement_total, revenu_total, benefice_net, roi, marge, seuil_unites, budget_respecte, complete) VALUES
('TEM-0002', 'Projet Industrielle - TEM-0002', 'Projet immobilier sur parcelle TEM-0002 (zone industrielle, 11891.99 m2)', 11891.99, 45760760.95, 15544514.81, 10, 5493.56, 20334268.18, 3656353.18, 1128646.35, NULL, '2025-07-10T00:00:00Z', 2, 2, 39535136.17, 11286463.5, -28248672.67, -71.45, -250.29, 35.03, TRUE, TRUE),
('TEM-0003', 'Projet Résidentielle - TEM-0003', 'Projet immobilier sur parcelle TEM-0003 (zone résidentielle, 1316.87 m2)', 1316.87, 3368067.19, 4249755.79, 6, 629.94, 2970657.8, 1011827.2, 747718.25, 4452568.77, '2025-01-16T00:00:00Z', 1, 9, 8232240.79, 4452568.77, -3779672.02, -45.91, -84.89, 11.01, FALSE, TRUE),
('TEM-0004', 'Projet Industrielle - TEM-0004', 'Projet immobilier sur parcelle TEM-0004 (zone industrielle, 3354.29 m2)', 3354.29, 9057735.55, 3209547.11, 2, 1197.92, 4364543.01, 863185.93, 893664.02, 1700198.34, '2025-01-05T00:00:00Z', 2, 11, 8437276.05, 1700198.34, -6737077.71, -79.85, -396.25, 9.44, TRUE, TRUE),
('TEM-0007', 'Projet Agricole - TEM-0007', 'Projet immobilier sur parcelle TEM-0007 (zone agricole, 18712.85 m2)', 18712.85, 9396206.97, 3204522.99, 2, 2160.96, 5200952.58, 921358.61, 170800.87, 355702.52, '2025-04-21T00:00:00Z', 4, 7, 9326834.18, 355702.52, -8971131.66, -96.19, -2522.09, 54.61, TRUE, TRUE),
('TEM-0010', 'Projet Agricole - TEM-0010', 'Projet immobilier sur parcelle TEM-0010 (zone agricole, 17883.65 m2)', 17883.65, 7607714.11, 3164525.75, 1, 1414.42, 2923360.75, 374527.65, 203375.42, 188807.97, '2026-03-06T00:00:00Z', 4, 2, 6462414.15, 188807.97, -6273606.18, -97.08, -3322.74, 31.78, TRUE, TRUE),
('TEM-0012', 'Projet Industrielle - TEM-0012', 'Projet immobilier sur parcelle TEM-0012 (zone industrielle, 736.32 m2)', 736.32, 2575104.62, 1037929.61, 1, 286.94, 969105.97, 181276.17, 613634.56, 655150.39, '2025-01-12T00:00:00Z', 2, 1, 2188311.75, 655150.39, -1533161.36, -70.06, -234.02, 3.57, TRUE, TRUE),
('TEM-0013', 'Projet Agricole - TEM-0013', 'Projet immobilier sur parcelle TEM-0013 (zone agricole, 16472.7 m2)', 16472.7, 10348223.58, 4385608.65, 2, 1625.56, 4359877.81, 673006.22, 396320.35, 782397.31, '2025-08-06T00:00:00Z', 4, 1, 9418492.68, 782397.31, -8636095.37, -91.69, -1103.8, 23.76, TRUE, TRUE),
('TEM-0014', 'Projet Résidentielle - TEM-0014', 'Projet immobilier sur parcelle TEM-0014 (zone résidentielle, 9901.24 m2)', 9901.24, 67854676.38, 27926729.09, 52, 6378.24, 32948709.36, 5318873.55, 555355.11, 30515883.51, '2025-05-30T00:00:00Z', 1, 4, 66194312.0, 30515883.51, -35678428.49, -53.9, -116.92, 119.19, TRUE, TRUE),
('TEM-0021', 'Projet Agricole - TEM-0021', 'Projet immobilier sur parcelle TEM-0021 (zone agricole, 22303.1 m2)', 22303.1, 10873815.93, 5807402.07, 1, 1136.51, 2966669.74, 1182096.06, 168570.25, 172254.18, '2026-04-10T00:00:00Z', 4, 3, 9956167.87, 172254.18, -9783913.69, -98.27, -5679.93, 59.06, TRUE, TRUE),
('TEM-0029', 'Projet Industrielle - TEM-0029', 'Projet immobilier sur parcelle TEM-0029 (zone industrielle, 20532.7 m2)', 20532.7, 78656118.42, 36203692.04, 23, 9172.88, 29783815.01, 9105438.6, 738721.79, 17854544.56, '2025-07-21T00:00:00Z', 2, 11, 75092945.65, 17854544.56, -57238401.09, -76.22, -320.58, 101.65, TRUE, TRUE),
('TEM-0031', 'Projet Équipements publics - TEM-0031', 'Projet immobilier sur parcelle TEM-0031 (zone équipements publics, 23622.86 m2)', 23622.86, 31269890.17, 50792358.22, 64, 11254.83, 44845933.48, 9365967.91, 527087.53, 32321687.1, '2026-05-18T00:00:00Z', 3, 5, 105004259.61, 32321687.1, -72682572.51, -69.22, -224.87, 199.22, FALSE, TRUE),
('TEM-0032', 'Projet Résidentielle - TEM-0032', 'Projet immobilier sur parcelle TEM-0032 (zone résidentielle, 32469.29 m2)', 32469.29, 293593050.39, 110271250.97, 209, 20645.51, 112749320.49, 15918319.81, 776753.8, 151279982.92, '2025-01-17T00:00:00Z', 1, 2, 238938891.27, 151279982.92, -87658908.35, -36.69, -57.94, 307.61, TRUE, TRUE),
('TEM-0040', 'Projet Résidentielle - TEM-0040', 'Projet immobilier sur parcelle TEM-0040 (zone résidentielle, 14653.6 m2)', 14653.6, 94905036.15, 41310638.33, 86, 7900.36, 30833323.38, 5473045.81, 736084.71, NULL, '2025-12-05T00:00:00Z', 1, 11, 77617007.52, 63303285.06, -14313722.46, -18.44, -22.61, 105.45, TRUE, TRUE),
('TEM-0042', 'Projet Résidentielle - TEM-0042', 'Projet immobilier sur parcelle TEM-0042 (zone résidentielle, 13018.4 m2)', 13018.4, 114688077.34, 50585359.11, 58, 7217.24, 39042759.24, 10135936.96, 687396.45, 38668488.96, '2025-03-18T00:00:00Z', 1, 8, 99764055.31, 38668488.96, -61095566.35, -61.24, -158.0, 145.13, TRUE, TRUE),
('TEM-0044', 'Projet Agricole - TEM-0044', 'Projet immobilier sur parcelle TEM-0044 (zone agricole, 30252.19 m2)', 30252.19, 4197343.15, 5046599.05, 3, 2453.64, 5242461.47, 684416.83, 241943.98, NULL, '2025-05-13T00:00:00Z', 4, 6, 10973477.35, 725831.94, -10247645.41, -93.39, -1411.85, 45.36, FALSE, TRUE),
('TEM-0045', 'Projet Industrielle - TEM-0045', 'Projet immobilier sur parcelle TEM-0045 (zone industrielle, 22534.69 m2)', 22534.69, 84445182.78, 27416846.07, 22, 10975.05, 40290360.32, 9370617.33, 1311478.8, 29188642.53, '2025-01-13T00:00:00Z', 2, 10, 77077823.72, 29188642.53, -47889181.19, -62.13, -164.07, 58.77, TRUE, TRUE),
('TEM-0056', 'Projet Agricole - TEM-0056', 'Projet immobilier sur parcelle TEM-0056 (zone agricole, 8561.59 m2)', 8561.59, 3031574.08, 1438880.28, 1, 505.69, 1069827.82, 208594.8, 232537.47, 239761.25, '2025-03-27T00:00:00Z', 4, 9, 2717302.9, 239761.25, -2477541.65, -91.18, -1033.34, 11.69, TRUE, TRUE),
('TEM-0058', 'Projet Résidentielle - TEM-0058', 'Projet immobilier sur parcelle TEM-0058 (zone résidentielle, 25157.66 m2)', 25157.66, 60747131.94, 98755976.91, 137, 11470.84, 55314512.01, 15913341.99, 799167.34, 111491764.88, '2025-01-12T00:00:00Z', 1, 6, 169983830.91, 111491764.88, -58492066.03, -34.41, -52.46, 212.7, FALSE, TRUE),
('TEM-0060', 'Projet Agricole - TEM-0060', 'Projet immobilier sur parcelle TEM-0060 (zone agricole, 14668.42 m2)', 14668.42, 8918528.22, 3304181.3, 1, 1728.14, 3806356.95, 535172.13, 314997.5, 334740.38, '2025-07-23T00:00:00Z', 4, 11, 7645710.38, 334740.38, -7310970.0, -95.62, -2184.07, 24.27, TRUE, TRUE),
('TEM-0063', 'Projet Résidentielle - TEM-0063', 'Projet immobilier sur parcelle TEM-0063 (zone résidentielle, 14569.92 m2)', 14569.92, 129735866.56, 46493476.52, 96, 8905.1, 47679473.04, 13111153.81, 741553.59, 67045097.26, '2025-02-11T00:00:00Z', 1, 12, 107284103.37, 67045097.26, -40239006.11, -37.51, -60.02, 144.67, TRUE, TRUE),
('TEM-0064', 'Projet Résidentielle - TEM-0064', 'Projet immobilier sur parcelle TEM-0064 (zone résidentielle, 27227.23 m2)', 27227.23, 194169855.98, 63916459.78, 179, 17590.75, 91421906.43, 10897707.75, 912865.93, 160332282.75, '2026-04-09T00:00:00Z', 1, 6, 166236073.96, 160332282.75, -5903791.21, -3.55, -3.68, 182.1, TRUE, TRUE),
('TEM-0066', 'Projet Industrielle - TEM-0066', 'Projet immobilier sur parcelle TEM-0066 (zone industrielle, 23899.79 m2)', 23899.79, 59466623.87, 23116146.84, 13, 8515.43, 30950844.13, 3445903.22, 1113523.76, 15150991.92, '2026-04-11T00:00:00Z', 2, 4, 57512894.19, 15150991.92, -42361902.27, -73.66, -279.6, 51.65, TRUE, TRUE),
('TEM-0068', 'Projet Industrielle - TEM-0068', 'Projet immobilier sur parcelle TEM-0068 (zone industrielle, 12274.13 m2)', 12274.13, 37523198.87, 11319863.74, 20, 6332.64, 17786053.52, 2115380.44, 1166262.28, 23810277.24, '2025-03-21T00:00:00Z', 2, 11, 31221297.7, 23810277.24, -7411020.46, -23.74, -31.13, 26.77, TRUE, TRUE),
('TEM-0069', 'Projet Industrielle - TEM-0069', 'Projet immobilier sur parcelle TEM-0069 (zone industrielle, 30138.88 m2)', 30138.88, 102677894.77, 32497105.39, 23, 15514.52, 43950383.81, 9500898.73, 1081363.67, NULL, '2026-06-17T00:00:00Z', 2, 9, 85948387.93, 24871364.41, -61077023.52, -71.06, -245.57, 79.48, TRUE, TRUE),
('TEM-0070', 'Projet Résidentielle - TEM-0070', 'Projet immobilier sur parcelle TEM-0070 (zone résidentielle, 10741.47 m2)', 10741.47, 85237054.29, 38811397.75, 52, 6458.22, 28861640.26, 8883703.72, 493604.83, 26580708.01, '2025-01-07T00:00:00Z', 1, 7, 76556741.73, 26580708.01, -49976033.72, -65.28, -188.02, 155.1, TRUE, TRUE),
('TEM-0072', 'Projet Agricole - TEM-0072', 'Projet immobilier sur parcelle TEM-0072 (zone agricole, 19163.54 m2)', 19163.54, 4734039.92, 5509580.36, 3, 2208.93, 5528179.55, 1476305.87, 231616.82, 650264.92, '2025-05-07T00:00:00Z', 4, 4, 12514065.78, 650264.92, -11863800.86, -94.8, -1824.46, 54.03, FALSE, TRUE),
('TEM-0074', 'Projet Résidentielle - TEM-0074', 'Projet immobilier sur parcelle TEM-0074 (zone résidentielle, 22359.85 m2)', 22359.85, 132662327.9, 61652173.69, 92, 11807.0, 46629763.07, 9516594.53, 916134.89, 87227867.21, '2025-02-08T00:00:00Z', 1, 8, 117798531.29, 87227867.21, -30570664.08, -25.95, -35.05, 128.58, TRUE, TRUE),
('TEM-0076', 'Projet Industrielle - TEM-0076', 'Projet immobilier sur parcelle TEM-0076 (zone industrielle, 26187.43 m2)', 26187.43, 85868266.52, 31630452.74, 28, 11372.77, 32501486.87, 9156644.65, 1380794.05, 35786408.42, '2025-05-24T00:00:00Z', 2, 8, 73288584.26, 35786408.42, -37502175.84, -51.17, -104.79, 53.08, TRUE, TRUE),
('TEM-0077', 'Projet Résidentielle - TEM-0077', 'Projet immobilier sur parcelle TEM-0077 (zone résidentielle, 29108.88 m2)', 29108.88, 185770547.37, 73993427.35, 145, 16106.09, 81014645.09, 21018765.98, 922873.7, 143433382.52, '2026-06-24T00:00:00Z', 1, 9, 176026838.42, 143433382.52, -32593455.9, -18.52, -22.72, 190.74, TRUE, TRUE),
('TEM-0081', 'Projet Résidentielle - TEM-0081', 'Projet immobilier sur parcelle TEM-0081 (zone résidentielle, 32558.42 m2)', 32558.42, 84510772.52, 93357696.32, 161, 19397.29, 94776728.98, 20139873.99, 729985.54, 115294025.25, '2025-08-02T00:00:00Z', 1, 5, 208274299.29, 115294025.25, -92980274.04, -44.64, -80.65, 285.31, FALSE, TRUE),
('TEM-0086', 'Projet Résidentielle - TEM-0086', 'Projet immobilier sur parcelle TEM-0086 (zone résidentielle, 32031.89 m2)', 32031.89, 317447613.62, 133149322.38, 251, 20618.55, 96725414.05, 25646898.42, 717951.84, 183239937.83, '2026-06-13T00:00:00Z', 1, 7, 255521634.85, 183239937.83, -72281697.02, -28.29, -39.45, 355.9, TRUE, TRUE),
('TEM-0090', 'Projet Résidentielle - TEM-0090', 'Projet immobilier sur parcelle TEM-0090 (zone résidentielle, 28098.48 m2)', 28098.48, 66123326.35, 96973264.13, 228, 18204.45, 72950376.09, 11621074.89, 915412.92, 222765883.49, '2025-09-10T00:00:00Z', 1, 8, 181544715.11, 222765883.49, 41221168.38, 22.71, 18.5, 198.32, FALSE, TRUE),
('TEM-0092', 'Projet Agricole - TEM-0092', 'Projet immobilier sur parcelle TEM-0092 (zone agricole, 15774.09 m2)', 15774.09, 9397023.44, 4310414.3, 1, 1324.52, 3842293.09, 1175718.71, 281245.45, NULL, '2025-09-24T00:00:00Z', 4, 3, 9328426.1, 281245.45, -9047180.65, -96.99, -3216.83, 33.17, TRUE, TRUE),
('TEM-0102', 'Projet Agricole - TEM-0102', 'Projet immobilier sur parcelle TEM-0102 (zone agricole, 25254.18 m2)', 25254.18, 19107439.79, 8220909.18, 7, 3730.75, 7594407.43, 1170295.72, 221020.26, 1483886.41, '2025-05-06T00:00:00Z', 4, 9, 16985612.33, 1483886.41, -15501725.92, -91.26, -1044.67, 76.85, TRUE, TRUE),
('TEM-0105', 'Projet Résidentielle - TEM-0105', 'Projet immobilier sur parcelle TEM-0105 (zone résidentielle, 25641.63 m2)', 25641.63, 234306429.99, 93184495.44, 213, 15219.31, 75979739.57, 23528349.78, 766503.3, 166290033.88, '2026-07-01T00:00:00Z', 1, 11, 192692584.79, 166290033.88, -26402550.91, -13.7, -15.88, 251.39, TRUE, TRUE),
('TEM-0106', 'Projet Industrielle - TEM-0106', 'Projet immobilier sur parcelle TEM-0106 (zone industrielle, 22345.68 m2)', 22345.68, 67451259.24, 24502247.53, 24, 8787.09, 28169861.11, 5941309.55, 1423341.16, 33327202.96, '2025-07-19T00:00:00Z', 2, 4, 58613418.19, 33327202.96, -25286215.23, -43.14, -75.87, 41.18, TRUE, TRUE),
('TEM-0107', 'Projet Industrielle - TEM-0107', 'Projet immobilier sur parcelle TEM-0107 (zone industrielle, 26543.7 m2)', 26543.7, 31627320.98, 42482743.38, 28, 10323.07, 27107559.13, 9743155.89, 679329.97, 18822801.17, '2025-05-10T00:00:00Z', 2, 4, 79333458.4, 18822801.17, -60510657.23, -76.27, -321.48, 116.78, FALSE, TRUE),
('TEM-0108', 'Projet Équipements publics - TEM-0108', 'Projet immobilier sur parcelle TEM-0108 (zone équipements publics, 36176.73 m2)', 36176.73, 139710757.37, 57983295.95, 49, 15810.79, 50959540.3, 8506699.59, 1137961.08, 52328931.23, '2026-05-30T00:00:00Z', 3, 11, 117449535.84, 52328931.23, -65120604.61, -55.45, -124.44, 103.21, TRUE, TRUE),
('TEM-0111', 'Projet Équipements publics - TEM-0111', 'Projet immobilier sur parcelle TEM-0111 (zone équipements publics, 19294.52 m2)', 19294.52, 80019807.99, 39224776.56, 26, 8886.45, 34005739.72, 4554017.16, 929354.42, 24090829.33, '2025-06-26T00:00:00Z', 3, 3, 77784533.44, 24090829.33, -53693704.11, -69.03, -222.88, 83.7, TRUE, TRUE),
('TEM-0113', 'Projet Équipements publics - TEM-0113', 'Projet immobilier sur parcelle TEM-0113 (zone équipements publics, 12183.13 m2)', 12183.13, 55739692.72, 26684726.45, 15, 5913.43, 19655178.98, 3038741.96, 823449.52, 12009505.19, '2026-03-17T00:00:00Z', 3, 4, 49378647.39, 12009505.19, -37369142.2, -75.68, -311.16, 59.97, TRUE, TRUE),
('TEM-0115', 'Projet Équipements publics - TEM-0115', 'Projet immobilier sur parcelle TEM-0115 (zone équipements publics, 26667.05 m2)', 26667.05, 96057035.9, 48025485.01, 41, 8070.76, 33181631.3, 11042840.75, 817765.69, 33020382.3, '2026-06-09T00:00:00Z', 3, 1, 92249957.06, 33020382.3, -59229574.76, -64.21, -179.37, 112.81, TRUE, TRUE),
('TEM-0120', 'Projet Résidentielle - TEM-0120', 'Projet immobilier sur parcelle TEM-0120 (zone résidentielle, 22149.0 m2)', 22149.0, 147469838.21, 65217784.74, 83, 10342.81, 54105729.64, 16562873.95, 919793.28, 72567815.02, '2025-09-22T00:00:00Z', 1, 5, 135886388.33, 72567815.02, -63318573.31, -46.6, -87.25, 147.74, TRUE, TRUE),
('TEM-0124', 'Projet Résidentielle - TEM-0124', 'Projet immobilier sur parcelle TEM-0124 (zone résidentielle, 26754.97 m2)', 26754.97, 97049122.38, 114939023.78, 170, 16023.2, 82080116.92, 26266149.51, 898272.53, 157465851.13, '2026-02-20T00:00:00Z', 1, 4, 223285290.21, 157465851.13, -65819439.08, -29.48, -41.8, 248.57, FALSE, TRUE),
('TEM-0126', 'Projet Résidentielle - TEM-0126', 'Projet immobilier sur parcelle TEM-0126 (zone résidentielle, 15409.54 m2)', 15409.54, 123774570.48, 59512552.87, 101, 7151.73, 31331169.32, 9283831.89, 627818.59, 64667931.33, '2025-11-03T00:00:00Z', 1, 6, 100127554.08, 64667931.33, -35459622.75, -35.41, -54.83, 159.48, TRUE, TRUE),
('TEM-0127', 'Projet Équipements publics - TEM-0127', 'Projet immobilier sur parcelle TEM-0127 (zone équipements publics, 14439.21 m2)', 14439.21, 48033714.3, 20446611.75, 20, 5504.61, 18916866.23, 2634009.37, 848316.5, 15933719.66, '2025-04-28T00:00:00Z', 3, 10, 41997487.35, 15933719.66, -26063767.69, -62.06, -163.58, 49.51, TRUE, TRUE),
('TEM-0128', 'Projet Agricole - TEM-0128', 'Projet immobilier sur parcelle TEM-0128 (zone agricole, 13085.65 m2)', 13085.65, 5521845.41, 2316347.9, 1, 964.45, 2356774.85, 492680.4, 312002.4, NULL, '2025-12-16T00:00:00Z', 4, 9, 5165803.15, 312002.4, -4853800.75, -93.96, -1555.69, 16.56, TRUE, TRUE),
('TEM-0134', 'Projet Équipements publics - TEM-0134', 'Projet immobilier sur parcelle TEM-0134 (zone équipements publics, 26805.3 m2)', 26805.3, 121709812.35, 46654290.03, 59, 10270.11, 39815954.9, 11775053.96, 811040.79, 48229743.57, '2026-01-31T00:00:00Z', 3, 3, 98245298.89, 48229743.57, -50015555.32, -50.91, -103.7, 121.13, TRUE, TRUE),
('TEM-0137', 'Projet Résidentielle - TEM-0137', 'Projet immobilier sur parcelle TEM-0137 (zone résidentielle, 20120.2 m2)', 20120.2, 155649899.44, 62122640.81, 122, 12957.69, 68088035.77, 14163774.75, 664789.16, 78306969.96, '2026-06-28T00:00:00Z', 1, 5, 144374451.33, 78306969.96, -66067481.37, -45.76, -84.37, 217.17, TRUE, TRUE),
('TEM-0140', 'Projet Équipements publics - TEM-0140', 'Projet immobilier sur parcelle TEM-0140 (zone équipements publics, 5349.47 m2)', 5349.47, 21414398.09, 9004455.94, 6, 1893.45, 8346929.66, 2077366.01, 518802.92, 3155554.25, '2026-02-04T00:00:00Z', 3, 1, 19428751.61, 3155554.25, -16273197.36, -83.76, -515.7, 37.45, TRUE, TRUE),
('TEM-0141', 'Projet Équipements publics - TEM-0141', 'Projet immobilier sur parcelle TEM-0141 (zone équipements publics, 2280.15 m2)', 2280.15, 11614786.85, 4782710.65, 3, 1025.32, 3347880.69, 1211370.71, 551453.0, 1635702.0, '2025-09-07T00:00:00Z', 3, 1, 9341962.05, 1635702.0, -7706260.05, -82.49, -471.13, 16.94, TRUE, TRUE),
('TEM-0143', 'Projet Agricole - TEM-0143', 'Projet immobilier sur parcelle TEM-0143 (zone agricole, 28667.81 m2)', 28667.81, 23657585.22, 8051063.75, 3, 4120.34, 11218605.33, 1968426.21, 354174.01, 997086.53, '2025-07-28T00:00:00Z', 4, 1, 21238095.29, 997086.53, -20241008.76, -95.31, -2030.02, 59.97, TRUE, TRUE),
('TEM-0146', 'Projet Agricole - TEM-0146', 'Projet immobilier sur parcelle TEM-0146 (zone agricole, 22638.81 m2)', 22638.81, 11343523.58, 5414620.81, 2, 1482.22, 3502933.58, 647236.48, 300262.75, 618013.41, '2025-05-21T00:00:00Z', 4, 5, 9564790.87, 618013.41, -8946777.46, -93.54, -1447.67, 31.85, TRUE, TRUE),
('TEM-0149', 'Projet Agricole - TEM-0149', 'Projet immobilier sur parcelle TEM-0149 (zone agricole, 19871.5 m2)', 19871.5, 12662871.19, 6628559.64, 1, 1467.33, 3101742.74, 1365579.49, 306244.11, 295048.41, '2025-07-14T00:00:00Z', 4, 11, 11095881.87, 295048.41, -10800833.46, -97.34, -3660.7, 36.23, TRUE, TRUE),
('TEM-0150', 'Projet Équipements publics - TEM-0150', 'Projet immobilier sur parcelle TEM-0150 (zone équipements publics, 23926.59 m2)', 23926.59, 85107587.39, 35378829.09, 27, 8323.75, 36936344.39, 7607080.18, 637184.44, 17557444.65, '2025-01-28T00:00:00Z', 3, 10, 79922253.66, 17557444.65, -62364809.01, -78.03, -355.2, 125.43, TRUE, TRUE),
('TEM-0151', 'Projet Industrielle - TEM-0151', 'Projet immobilier sur parcelle TEM-0151 (zone industrielle, 26155.39 m2)', 26155.39, 66262474.89, 24435429.3, 14, 10318.62, 29529567.65, 6908649.42, 744771.5, 11230065.26, '2025-12-13T00:00:00Z', 2, 6, 60873646.37, 11230065.26, -49643581.11, -81.55, -442.06, 81.73, TRUE, TRUE),
('TEM-0163', 'Projet Industrielle - TEM-0163', 'Projet immobilier sur parcelle TEM-0163 (zone industrielle, 25709.29 m2)', 25709.29, 93706119.64, 34578099.77, 18, 9683.98, 35157600.65, 9219250.11, 1339837.84, 25154841.16, '2026-02-04T00:00:00Z', 2, 3, 78954950.53, 25154841.16, -53800109.37, -68.14, -213.88, 58.93, TRUE, TRUE),
('TEM-0165', 'Projet Résidentielle - TEM-0165', 'Projet immobilier sur parcelle TEM-0165 (zone résidentielle, 13392.71 m2)', 13392.71, 93119407.73, 40828814.68, 76, 7777.57, 42633582.0, 7451953.01, 823052.38, 61827904.75, '2025-11-28T00:00:00Z', 1, 2, 90914349.69, 61827904.75, -29086444.94, -31.99, -47.04, 110.46, TRUE, TRUE),
('TEM-0167', 'Projet Résidentielle - TEM-0167', 'Projet immobilier sur parcelle TEM-0167 (zone résidentielle, 15955.41 m2)', 15955.41, 133349688.8, 55051842.75, 88, 8558.45, 40785682.98, 12782527.65, 861748.13, NULL, '2025-03-25T00:00:00Z', 1, 12, 108620053.38, 75833835.44, -32786217.94, -30.18, -43.23, 126.05, TRUE, TRUE),
('TEM-0169', 'Projet Résidentielle - TEM-0169', 'Projet immobilier sur parcelle TEM-0169 (zone résidentielle, 4703.86 m2)', 4703.86, 35236055.19, 13635323.78, 36, 2798.79, 13937323.27, 2356423.66, 628900.82, 22156447.6, '2025-10-13T00:00:00Z', 1, 8, 29929070.71, 22156447.6, -7772623.11, -25.97, -35.08, 47.59, TRUE, TRUE),
('TEM-0174', 'Projet Agricole - TEM-0174', 'Projet immobilier sur parcelle TEM-0174 (zone agricole, 28281.98 m2)', 28281.98, 4082302.62, 7991152.91, 3, 4220.71, 10375669.52, 1467678.2, 332446.89, 931003.49, '2026-02-10T00:00:00Z', 4, 10, 19834500.63, 931003.49, -18903497.14, -95.31, -2030.44, 59.66, FALSE, TRUE),
('TEM-0175', 'Projet Équipements publics - TEM-0175', 'Projet immobilier sur parcelle TEM-0175 (zone équipements publics, 15947.08 m2)', 15947.08, 22694501.43, 25317263.34, 19, 5405.93, 21261231.29, 6136132.29, 1085463.45, 19556621.6, '2025-10-16T00:00:00Z', 3, 1, 52714626.92, 19556621.6, -33158005.32, -62.9, -169.55, 48.56, FALSE, TRUE),
('TEM-0178', 'Projet Industrielle - TEM-0178', 'Projet immobilier sur parcelle TEM-0178 (zone industrielle, 24753.41 m2)', 24753.41, 63502065.94, 27206872.53, 29, 8949.48, 24219883.38, 4455054.95, 1357519.06, 39884310.65, '2025-12-09T00:00:00Z', 2, 2, 55881810.86, 39884310.65, -15997500.21, -28.63, -40.11, 41.16, TRUE, TRUE),
('TEM-0181', 'Projet Industrielle - TEM-0181', 'Projet immobilier sur parcelle TEM-0181 (zone industrielle, 30169.25 m2)', 30169.25, 24901195.99, 34582402.25, 18, 11195.24, 32555190.74, 4185114.88, 687704.48, 12224297.59, '2026-06-19T00:00:00Z', 2, 6, 71322707.87, 12224297.59, -59098410.28, -82.86, -483.45, 103.71, FALSE, TRUE),
('TEM-0182', 'Projet Équipements publics - TEM-0182', 'Projet immobilier sur parcelle TEM-0182 (zone équipements publics, 7220.25 m2)', 7220.25, 12933657.19, 14185692.36, 9, 2735.58, 9955206.91, 3552198.94, 845563.37, 7879083.42, '2026-02-25T00:00:00Z', 3, 11, 27693098.21, 7879083.42, -19814014.79, -71.55, -251.48, 32.75, FALSE, TRUE),
('TEM-0184', 'Projet Résidentielle - TEM-0184', 'Projet immobilier sur parcelle TEM-0184 (zone résidentielle, 4024.19 m2)', 4024.19, 21568790.87, 12084965.72, 19, 1814.0, 8058804.04, 1370437.71, 720670.87, NULL, '2025-04-23T00:00:00Z', 1, 7, 21514207.47, 13692746.53, -7821460.94, -36.35, -57.12, 29.85, TRUE, TRUE),
('TEM-0185', 'Projet Résidentielle - TEM-0185', 'Projet immobilier sur parcelle TEM-0185 (zone résidentielle, 9085.23 m2)', 9085.23, 72965615.88, 39286282.48, 53, 5751.97, 24260225.46, 4740746.75, 792034.17, 41234481.52, '2025-03-02T00:00:00Z', 1, 8, 68287254.69, 41234481.52, -27052773.17, -39.62, -65.61, 86.22, TRUE, TRUE),
('TEM-0187', 'Projet Industrielle - TEM-0187', 'Projet immobilier sur parcelle TEM-0187 (zone industrielle, 5469.15 m2)', 5469.15, 3325657.36, 6440471.82, 5, 2039.79, 6817741.91, 1721368.95, 656110.06, 3324675.77, '2025-04-22T00:00:00Z', 2, 4, 14979582.68, 3324675.77, -11654906.91, -77.81, -350.56, 22.83, FALSE, TRUE),
('TEM-0192', 'Projet Équipements publics - TEM-0192', 'Projet immobilier sur parcelle TEM-0192 (zone équipements publics, 19193.03 m2)', 19193.03, 58284607.91, 26573519.45, 22, 6592.29, 23112775.89, 6188524.28, 656771.53, NULL, '2025-11-16T00:00:00Z', 3, 11, 55874819.62, 14448973.66, -41425845.96, -74.14, -286.7, 85.07, TRUE, TRUE),
('TEM-0193', 'Projet Équipements publics - TEM-0193', 'Projet immobilier sur parcelle TEM-0193 (zone équipements publics, 23219.71 m2)', 23219.71, 29112686.65, 40593499.82, 29, 10760.61, 41141454.14, 6820111.49, 1139977.1, 33309790.25, '2025-08-15T00:00:00Z', 3, 7, 88555065.45, 33309790.25, -55245275.2, -62.39, -165.85, 77.68, FALSE, TRUE);
"""

DROP_RENTABILITE = 'DROP VIEW IF EXISTS v_rentabilite; DROP TABLE IF EXISTS rentabilite;'


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0015_seed_donnees_couches'),
    ]

    operations = [
        migrations.RunSQL(CREATE_RENTABILITE + INSERT_RENTABILITE, DROP_RENTABILITE),
    ]
