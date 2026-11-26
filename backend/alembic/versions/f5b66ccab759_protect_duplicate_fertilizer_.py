"""protect duplicate fertilizer applications

Revision ID: f5b66ccab759
Revises: c9fa8fb82d4f
Create Date: 2026-11-26 08:28:16.843287

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5b66ccab759'
down_revision: Union[str, Sequence[str], None] = 'c9fa8fb82d4f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "fertilization_applications",
        sa.Column("dedupe_key", sa.String(length=64), nullable=True),
    )
    op.execute(
        "UPDATE fertilization_applications "
        "SET dedupe_key = 'legacy-' || CAST(id AS VARCHAR) "
        "WHERE dedupe_key IS NULL"
    )
    with op.batch_alter_table("fertilization_applications") as batch_op:
        batch_op.alter_column(
            "dedupe_key",
            existing_type=sa.String(length=64),
            nullable=False,
        )
        batch_op.create_unique_constraint(
            "uq_fertilization_applications_dedupe_key",
            ["dedupe_key"],
        )


def downgrade() -> None:
    with op.batch_alter_table("fertilization_applications") as batch_op:
        batch_op.drop_constraint(
            "uq_fertilization_applications_dedupe_key",
            type_="unique",
        )
        batch_op.drop_column("dedupe_key")
