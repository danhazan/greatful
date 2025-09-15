#!/bin/bash
# Monitoring Access Script for Grateful API

# Load monitoring configuration
if [ -f "apps/api/.env.monitoring" ]; then
    source apps/api/.env.monitoring
else
    echo "❌ Monitoring configuration not found. Please run setup first."
    exit 1
fi

API_URL="http://localhost:8000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to make authenticated requests
auth_curl() {
    curl -s -H "Authorization: Bearer $MONITORING_TOKEN" "$@"
}

# Function to display help
show_help() {
    echo "Grateful API Monitoring Access Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  health          - Basic health check"
    echo "  ready           - Readiness check"
    echo "  metrics         - System metrics (requires auth)"
    echo "  detailed        - Detailed health check (requires auth)"
    echo "  dashboard       - Monitoring dashboard (requires auth)"
    echo "  alerts          - Active alerts (requires auth)"
    echo "  incidents       - Active incidents (requires auth)"
    echo "  errors          - Error statistics"
    echo "  test-auth       - Test authentication"
    echo "  all             - Run all checks"
    echo "  help            - Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 health"
    echo "  $0 metrics"
    echo "  $0 all"
}

# Function to check basic health
check_health() {
    echo -e "${BLUE}=== Basic Health Check ===${NC}"
    response=$(curl -s "$API_URL/health")
    if [ $? -eq 0 ]; then
        echo "$response" | jq .
        status=$(echo "$response" | jq -r '.status')
        if [ "$status" = "healthy" ]; then
            echo -e "${GREEN}✅ Service is healthy${NC}"
        else
            echo -e "${YELLOW}⚠️  Service status: $status${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to connect to API${NC}"
    fi
    echo ""
}

# Function to check readiness
check_ready() {
    echo -e "${BLUE}=== Readiness Check ===${NC}"
    response=$(curl -s "$API_URL/ready")
    if [ $? -eq 0 ]; then
        echo "$response" | jq .
        status=$(echo "$response" | jq -r '.status')
        if [ "$status" = "ready" ]; then
            echo -e "${GREEN}✅ Service is ready${NC}"
        else
            echo -e "${YELLOW}⚠️  Service status: $status${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to connect to API${NC}"
    fi
    echo ""
}

# Function to get metrics
get_metrics() {
    echo -e "${BLUE}=== System Metrics ===${NC}"
    response=$(auth_curl "$API_URL/metrics")
    if [ $? -eq 0 ]; then
        if echo "$response" | jq . >/dev/null 2>&1; then
            echo "$response" | jq .
            echo -e "${GREEN}✅ Metrics retrieved successfully${NC}"
        else
            echo -e "${RED}❌ Authentication failed or invalid response${NC}"
            echo "$response"
        fi
    else
        echo -e "${RED}❌ Failed to get metrics${NC}"
    fi
    echo ""
}

# Function to get detailed health
get_detailed_health() {
    echo -e "${BLUE}=== Detailed Health Check ===${NC}"
    response=$(auth_curl "$API_URL/health/detailed")
    if [ $? -eq 0 ]; then
        if echo "$response" | jq . >/dev/null 2>&1; then
            echo "$response" | jq .
            status=$(echo "$response" | jq -r '.status')
            if [ "$status" = "healthy" ]; then
                echo -e "${GREEN}✅ All components healthy${NC}"
            else
                echo -e "${YELLOW}⚠️  System status: $status${NC}"
                issues=$(echo "$response" | jq -r '.issues[]' 2>/dev/null)
                if [ ! -z "$issues" ]; then
                    echo -e "${YELLOW}Issues found:${NC}"
                    echo "$issues"
                fi
            fi
        else
            echo -e "${RED}❌ Authentication failed or invalid response${NC}"
            echo "$response"
        fi
    else
        echo -e "${RED}❌ Failed to get detailed health${NC}"
    fi
    echo ""
}

# Function to get monitoring dashboard
get_dashboard() {
    echo -e "${BLUE}=== Monitoring Dashboard ===${NC}"
    response=$(auth_curl "$API_URL/api/v1/monitoring/dashboard")
    if [ $? -eq 0 ]; then
        if echo "$response" | jq . >/dev/null 2>&1; then
            echo "$response" | jq .
            echo -e "${GREEN}✅ Dashboard data retrieved${NC}"
        else
            echo -e "${RED}❌ Authentication failed or invalid response${NC}"
            echo "$response"
        fi
    else
        echo -e "${RED}❌ Failed to get dashboard${NC}"
    fi
    echo ""
}

# Function to get alerts
get_alerts() {
    echo -e "${BLUE}=== Active Alerts ===${NC}"
    response=$(auth_curl "$API_URL/api/v1/monitoring/alerts")
    if [ $? -eq 0 ]; then
        if echo "$response" | jq . >/dev/null 2>&1; then
            active_count=$(echo "$response" | jq -r '.summary.active_count')
            echo "Active alerts: $active_count"
            echo "$response" | jq '.active_alerts'
            if [ "$active_count" = "0" ]; then
                echo -e "${GREEN}✅ No active alerts${NC}"
            else
                echo -e "${YELLOW}⚠️  $active_count active alerts${NC}"
            fi
        else
            echo -e "${RED}❌ Authentication failed or invalid response${NC}"
            echo "$response"
        fi
    else
        echo -e "${RED}❌ Failed to get alerts${NC}"
    fi
    echo ""
}

# Function to get incidents
get_incidents() {
    echo -e "${BLUE}=== Active Incidents ===${NC}"
    response=$(auth_curl "$API_URL/api/v1/monitoring/incidents")
    if [ $? -eq 0 ]; then
        if echo "$response" | jq . >/dev/null 2>&1; then
            incident_count=$(echo "$response" | jq -r '.summary.active_incidents')
            echo "Active incidents: $incident_count"
            echo "$response" | jq '.active_incidents'
            if [ "$incident_count" = "0" ]; then
                echo -e "${GREEN}✅ No active incidents${NC}"
            else
                echo -e "${RED}❌ $incident_count active incidents${NC}"
            fi
        else
            echo -e "${RED}❌ Authentication failed or invalid response${NC}"
            echo "$response"
        fi
    else
        echo -e "${RED}❌ Failed to get incidents${NC}"
    fi
    echo ""
}

# Function to get error statistics
get_errors() {
    echo -e "${BLUE}=== Error Statistics ===${NC}"
    response=$(curl -s "$API_URL/api/errors/stats")
    if [ $? -eq 0 ]; then
        echo "$response" | jq .
        echo -e "${GREEN}✅ Error statistics retrieved${NC}"
    else
        echo -e "${RED}❌ Failed to get error statistics${NC}"
    fi
    echo ""
}

# Function to test authentication
test_auth() {
    echo -e "${BLUE}=== Testing Authentication ===${NC}"
    echo "Testing with token: ${MONITORING_TOKEN:0:8}..."
    
    # Test without auth (should fail)
    echo "Testing without authentication:"
    response=$(curl -s "$API_URL/metrics")
    if echo "$response" | grep -q "Invalid or missing monitoring token"; then
        echo -e "${GREEN}✅ Unauthenticated access properly blocked${NC}"
    else
        echo -e "${RED}❌ Security issue: unauthenticated access allowed${NC}"
    fi
    
    # Test with auth (should succeed)
    echo "Testing with authentication:"
    response=$(auth_curl "$API_URL/metrics")
    if echo "$response" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Authenticated access successful${NC}"
    else
        echo -e "${RED}❌ Authentication failed${NC}"
        echo "$response"
    fi
    echo ""
}

# Main script logic
case "${1:-help}" in
    "health")
        check_health
        ;;
    "ready")
        check_ready
        ;;
    "metrics")
        get_metrics
        ;;
    "detailed")
        get_detailed_health
        ;;
    "dashboard")
        get_dashboard
        ;;
    "alerts")
        get_alerts
        ;;
    "incidents")
        get_incidents
        ;;
    "errors")
        get_errors
        ;;
    "test-auth")
        test_auth
        ;;
    "all")
        check_health
        check_ready
        get_metrics
        get_detailed_health
        get_alerts
        get_incidents
        get_errors
        ;;
    "help"|*)
        show_help
        ;;
esac