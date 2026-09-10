INSERT INTO services (name, description, durationMinutes, priceCents, displayOrder, isActive)
SELECT 'Psicoterapia', 'Atendimento individual para compreender sentimentos, relações e momentos de mudança.', 50, 0, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Psicoterapia');
INSERT INTO services (name, description, durationMinutes, priceCents, displayOrder, isActive)
SELECT 'Terapia EMDR', 'Processo terapêutico focado na elaboração de experiências difíceis e traumas.', 60, 0, 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Terapia EMDR');
INSERT INTO services (name, description, durationMinutes, priceCents, displayOrder, isActive)
SELECT 'Educação parental', 'Orientação para relações familiares mais conscientes e conectadas.', 60, 0, 3, TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Educação parental');

INSERT INTO weekly_availability (weekday, label, isActive, startTime, endTime, slotMinutes)
SELECT 0, 'Domingo', FALSE, '08:00', '20:00', 60 WHERE NOT EXISTS (SELECT 1 FROM weekly_availability WHERE weekday = 0);
INSERT INTO weekly_availability (weekday, label, isActive, startTime, endTime, slotMinutes)
SELECT 1, 'Segunda-feira', TRUE, '08:00', '20:00', 60 WHERE NOT EXISTS (SELECT 1 FROM weekly_availability WHERE weekday = 1);
INSERT INTO weekly_availability (weekday, label, isActive, startTime, endTime, slotMinutes)
SELECT 2, 'Terça-feira', TRUE, '08:00', '20:00', 60 WHERE NOT EXISTS (SELECT 1 FROM weekly_availability WHERE weekday = 2);
INSERT INTO weekly_availability (weekday, label, isActive, startTime, endTime, slotMinutes)
SELECT 3, 'Quarta-feira', TRUE, '08:00', '20:00', 60 WHERE NOT EXISTS (SELECT 1 FROM weekly_availability WHERE weekday = 3);
INSERT INTO weekly_availability (weekday, label, isActive, startTime, endTime, slotMinutes)
SELECT 4, 'Quinta-feira', TRUE, '08:00', '20:00', 60 WHERE NOT EXISTS (SELECT 1 FROM weekly_availability WHERE weekday = 4);
INSERT INTO weekly_availability (weekday, label, isActive, startTime, endTime, slotMinutes)
SELECT 5, 'Sexta-feira', TRUE, '08:00', '20:00', 60 WHERE NOT EXISTS (SELECT 1 FROM weekly_availability WHERE weekday = 5);
INSERT INTO weekly_availability (weekday, label, isActive, startTime, endTime, slotMinutes)
SELECT 6, 'Sábado', FALSE, '08:00', '20:00', 60 WHERE NOT EXISTS (SELECT 1 FROM weekly_availability WHERE weekday = 6);
