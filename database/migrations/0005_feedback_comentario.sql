-- Migracao 0005: coluna de comentario livre nas avaliacoes de feedback
-- Permite que o usuario explique a avaliacao (util, confuso, incompleto, prolixo)

alter table feedback_respostas
    add column if not exists comentario text;
