"""add auth (employee fields, login emails, refresh_tokens)

Revision ID: e5f2b3c4d6a7
Revises: b7c4e2f91a03
Create Date: 2026-10-02 21:40:00.000000

"""

import os
from typing import Sequence, Union

import bcrypt
from alembic import op
import sqlalchemy as sa


revision: str = "e5f2b3c4d6a7"
down_revision: Union[str, Sequence[str], None] = "b7c4e2f91a03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Explicit id far from the identity sequence; reports to the MD so own trips still route
ADMIN_ID = 9000
ADMIN_EMAIL = "admin@nortex.com"

# Trip fields a draft may leave empty
DRAFT_OPTIONAL_COLUMNS = (
    ("start_date", sa.Date()),
    ("end_date", sa.Date()),
    ("destination", sa.String(length=255)),
    ("purpose", sa.Text()),
)


def upgrade() -> None:
    # Employee auth columns
    op.add_column(
        "employees",
        sa.Column("password_hash", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "employees",
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column(
        "employees",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Give seeded employees a shared demo password
    demo_password = os.getenv("DEMO_PASSWORD", "Nortex@2026")
    demo_hash = bcrypt.hashpw(demo_password.encode("utf-8"), bcrypt.gensalt()).decode()
    op.execute(
        sa.text("UPDATE employees SET password_hash = :hash WHERE password_hash IS NULL")
        .bindparams(hash=demo_hash)
    )

    # Login emails, e.g. "Chaitanya Reddy" → chaitanya@nortex.com (first names are unique)
    op.execute(
        "UPDATE employees "
        "SET email = lower(split_part(name, ' ', 1)) || '@nortex.com'"
    )

    # Refresh tokens (stored hashed); one family per login session
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("employee_id", sa.BigInteger(), nullable=False),
        sa.Column("family_id", sa.String(length=64), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        op.f("ix_refresh_tokens_employee_id"), "refresh_tokens", ["employee_id"]
    )
    op.create_index(
        op.f("ix_refresh_tokens_family_id"), "refresh_tokens", ["family_id"]
    )

    # Seed the Administrator login (role Admin) with the same demo password
    op.execute(
        sa.text(
            "INSERT INTO employees (id, employee_code, name, email, designation, department, "
            "cost_centre, city, reporting_manager_id, role, password_hash, is_active) "
            "VALUES (:id, 'NX-9000', 'Administrator', :email, 'System Administrator', "
            "'Administration', 'CE001', 'Mumbai', 1000, 'Admin', :hash, true) "
            "ON CONFLICT (email) DO NOTHING"
        ).bindparams(id=ADMIN_ID, email=ADMIN_EMAIL, hash=demo_hash)
    )

    # Drafts may be saved with trip fields still empty
    for name, type_ in DRAFT_OPTIONAL_COLUMNS:
        op.alter_column("travel_requests", name, existing_type=type_, nullable=True)


def downgrade() -> None:
    # Trip fields required again
    for name, type_ in DRAFT_OPTIONAL_COLUMNS:
        op.alter_column("travel_requests", name, existing_type=type_, nullable=False)

    # Remove the Administrator (refresh tokens cascade)
    op.execute(
        sa.text("DELETE FROM employees WHERE email = :email").bindparams(email=ADMIN_EMAIL)
    )

    # Drop refresh tokens
    op.drop_index(op.f("ix_refresh_tokens_family_id"), table_name="refresh_tokens")
    op.drop_index(op.f("ix_refresh_tokens_employee_id"), table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    # Restore the employee_master.csv email format: firstname.lastname@nortexindustries.com
    op.execute(
        "UPDATE employees "
        "SET email = lower(replace(name, ' ', '.')) || '@nortexindustries.com'"
    )

    # Drop employee auth columns
    op.drop_column("employees", "last_login_at")
    op.drop_column("employees", "is_active")
    op.drop_column("employees", "password_hash")
